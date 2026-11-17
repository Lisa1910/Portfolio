document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('projects-container');
    const counter = document.getElementById('project-counter');
    const liveToast = document.getElementById('live-toast');

    const modal = document.getElementById('viewer-modal');
    const sheetContainer = document.getElementById('sheet-container');
    const thumbsContainer = document.getElementById('viewer-thumbnails');
    const viewerTitle = document.getElementById('viewer-title');
    const viewerFolderId = document.getElementById('viewer-folder-id');
    const viewerPageInfo = document.getElementById('viewer-page-info');
    const btnJump3D = document.getElementById('btn-jump-3d');

    let projectsData = [];
    let currentProject = null;
    let currentFileIndex = 0;

    // 1. Показ тихого уведомления при фоновом обновлении каталога
    function showLiveToast() {
        if (!liveToast) return;
        liveToast.classList.add('visible');
        setTimeout(() => {
            liveToast.classList.remove('visible');
        }, 3500);
    }

    // 2. Обработка входящего manifest.json (из кэша или по сети)
    function applyManifestData(rawData, isBackgroundUpdate = false) {
        const list = Array.isArray(rawData) ? rawData : (rawData.projects || []);
        projectsData = list;
        renderProjectsGrid(projectsData);

        if (isBackgroundUpdate) {
            showLiveToast();
            // Если сейчас открыт конкретный проект, мягко синхронизируем его листы
            if (modal.classList.contains('active') && currentProject) {
                const updatedProj = projectsData.find(p => p.id === currentProject.id);
                if (updatedProj) {
                    currentProject = updatedProj;
                    if (currentFileIndex >= currentProject.files.length) {
                        currentFileIndex = Math.max(0, currentProject.files.length - 1);
                    }
                    renderThumbnails();
                    renderCurrentSheet();
                }
            }
        }
    }

    // Мгновенный старт из кэша (если пользователь уже заходил на сайт)
    if (window.PortfolioOptimizer) {
        const cached = window.PortfolioOptimizer.getCachedManifest();
        if (cached) {
            applyManifestData(cached, false);
        }
        // Запускаем фоновую синхронизацию в реальном времени
        window.PortfolioOptimizer.startLiveSync((freshData, wasChanged) => {
            applyManifestData(freshData, wasChanged && projectsData.length > 0);
        });
    } else {
        // Резервная загрузка, если optimizer.js не подключен
        fetch('manifest.json?v=' + Date.now())
            .then(res => res.json())
            .then(data => applyManifestData(data, false))
            .catch(() => {
                counter.textContent = 'НЕТ ДАННЫХ';
                container.innerHTML = `<p style="color: var(--burgundy);">Папка проектов пуста или не запущен <b>build.py</b>.</p>`;
            });
    }

    // 3. Отрисовка плашек проектов на главной странице
    function renderProjectsGrid(projects) {
        counter.textContent = `ВСЕГО ТОМОВ: ${projects.length}`;
        container.innerHTML = '';

        if (!projects.length) {
            container.innerHTML = `<p style="color: var(--ink-muted);">В папке <b>project/</b> пока нет проектов.</p>`;
            return;
        }

        projects.forEach((proj, index) => {
            const card = document.createElement('article');
            card.className = 'project-card';

            const coverSrc = proj.cover
                ? proj.cover
                : 'data:image/svg+xml;utf8,<svg xmlns="http://w3.org" width="400" height="250"><rect width="100%" height="100%" fill="%23EFEAE0"/><text x="50%" y="50%" font-family="serif" font-size="20" fill="%236E1E2A" text-anchor="middle">Документация / 3D</text></svg>';

            const badgesHtml = `
                <div class="card-badges">
                    ${proj.has3d ? '<span class="badge-3d">3D МОДЕЛЬ</span>' : ''}
                    <span class="card-count-badge">Листов: ${proj.files.length}</span>
                </div>
            `;

            const tagsHtml = (proj.tags && proj.tags.length)
                ? `<div class="card-tags">${proj.tags.map(t => `<span>${t}</span>`).join('')}</div>`
                : '';

            card.innerHTML = `
                <div class="card-image-wrap">
                    <img src="${coverSrc}" alt="${proj.title}" loading="lazy" decoding="async">
                    ${badgesHtml}
                </div>
                <div class="card-body">
                    <div>
                        <h3 class="card-title">${proj.title}</h3>
                        <p class="card-desc">${proj.description}</p>
                        ${tagsHtml}
                    </div>
                    <span class="card-action">Открыть том →</span>
                </div>
            `;

            card.addEventListener('click', () => openProject(index));
            container.appendChild(card);
        });
    }
    // 4. Открытие просмотрщика проекта
    function openProject(projectIndex) {
        currentProject = projectsData[projectIndex];
        currentFileIndex = 0;

        viewerFolderId.textContent = `ПАПКА №${currentProject.id}`;
        viewerTitle.textContent = currentProject.title;

        // Показываем кнопку быстрого перехода к 3D, если в папке есть .glb / .gltf
        const first3dIndex = currentProject.files.findIndex(f => f.type === '3d');
        if (first3dIndex !== -1 && btnJump3D) {
            btnJump3D.style.display = 'inline-flex';
            btnJump3D.onclick = () => {
                currentFileIndex = first3dIndex;
                renderCurrentSheet();
            };
        } else if (btnJump3D) {
            btnJump3D.style.display = 'none';
        }

        renderThumbnails();
        renderCurrentSheet();

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    // 5. Отрисовка активного листа (3D-модель, PDF или изображение)
    async function renderCurrentSheet() {
        if (!currentProject || !currentProject.files.length) return;

        const file = currentProject.files[currentFileIndex];
        const sizeLabel = file.sizeMb ? ` • ${file.sizeMb} МБ` : '';
        viewerPageInfo.textContent = `Лист ${currentFileIndex + 1} из ${currentProject.files.length} (${file.name}${sizeLabel})`;

        // Перезапуск анимации листания
        sheetContainer.style.animation = 'none';
        sheetContainer.offsetHeight;
        sheetContainer.style.animation = null;

        // Подсветка активной миниатюры
        document.querySelectorAll('.thumb-item').forEach((el, idx) => {
            el.classList.toggle('active', idx === currentFileIndex);
        });

        // Прогреваем соседние листы в фоне для мгновенного переключения
        if (window.PortfolioOptimizer) {
            window.PortfolioOptimizer.prefetchAdjacentSheets(currentProject.files, currentFileIndex);
        }

        if (file.type === '3d') {
            sheetContainer.innerHTML = `<div class="loader-3d">Загрузка 3D-сцены и геометрии...</div>`;
            try {
                if (window.PortfolioOptimizer) {
                    await window.PortfolioOptimizer.ensure3DEngine();
                }
                sheetContainer.innerHTML = `
                    <model-viewer
                        src="${file.path}"
                        alt="${file.name}"
                        camera-controls
                        touch-action="pan-y"
                        shadow-intensity="0.8"
                        exposure="1.05"
                        interaction-prompt="auto"
                        loading="eager"
                        style="width: 100%; height: 100%; background-color: #EFEAE0;">
                        <div slot="poster" class="loader-3d">Подготовка 3D-модели (${file.sizeMb || ''} МБ)...</div>
                    </model-viewer>
                `;
            } catch (e) {
                sheetContainer.innerHTML = `<p style="color: var(--burgundy);">Не удалось загрузить 3D-движок. Проверьте подключение к интернету.</p>`;
            }
        } else if (file.type === 'pdf') {
            sheetContainer.innerHTML = `<iframe src="${file.path}#view=FitH" title="${file.name}"></iframe>`;
        } else {
            sheetContainer.innerHTML = `<img src="${file.path}" alt="${file.name}" decoding="async">`;
        }
    }

    // 6. Лента миниатюр внизу просмотрщика
    function renderThumbnails() {
        thumbsContainer.innerHTML = '';
        currentProject.files.forEach((file, idx) => {
            const thumb = document.createElement('div');
            thumb.className = 'thumb-item';
            thumb.title = file.name;

            if (file.type === '3d') {
                thumb.innerHTML = `<span class="thumb-3d-tag">3D<br>МОДЕЛЬ</span>`;
            } else if (file.type === 'pdf') {
                thumb.innerHTML = `<span>PDF<br>${idx + 1}</span>`;
            } else {
                thumb.innerHTML = `<img src="${file.path}" alt="Лист ${idx + 1}" loading="lazy">`;
            }

            thumb.addEventListener('click', () => {
                currentFileIndex = idx;
                renderCurrentSheet();
            });
            thumbsContainer.appendChild(thumb);
        });
    }

    // 7. Навигация и закрытие
    function nextSheet() {
        if (!currentProject) return;
        currentFileIndex = (currentFileIndex + 1) % currentProject.files.length;
        renderCurrentSheet();
    }

    function prevSheet() {
        if (!currentProject) return;
        currentFileIndex = (currentFileIndex - 1 + currentProject.files.length) % currentProject.files.length;
        renderCurrentSheet();
    }

    function closeViewer() {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        sheetContainer.innerHTML = '';
    }

    document.getElementById('btn-next').addEventListener('click', nextSheet);
    document.getElementById('btn-prev').addEventListener('click', prevSheet);
    document.getElementById('viewer-close').addEventListener('click', closeViewer);
    document.getElementById('viewer-close-bg').addEventListener('click', closeViewer);

    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('active')) return;
        if (e.key === 'Escape') closeViewer();
        if (e.key === 'ArrowRight') nextSheet();
        if (e.key === 'ArrowLeft') prevSheet();
    });
});
