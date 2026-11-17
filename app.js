document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('projects-container');
    const counter = document.getElementById('project-counter');

    const modal = document.getElementById('viewer-modal');
    const sheetContainer = document.getElementById('sheet-container');
    const thumbsContainer = document.getElementById('viewer-thumbnails');
    const viewerTitle = document.getElementById('viewer-title');
    const viewerFolderId = document.getElementById('viewer-folder-id');
    const viewerPageInfo = document.getElementById('viewer-page-info');

    let projectsData = [];
    let currentProject = null;
    let currentFileIndex = 0;

    // 1. Загружаем список проектов из manifest.json
    fetch('manifest.json?v=' + Date.now())
        .then(response => {
            if (!response.ok) throw new Error('Файл manifest.json не найден');
            return response.json();
        })
        .then(data => {
            projectsData = data;
            renderProjectsGrid(projectsData);
        })
        .catch(err => {
            counter.textContent = 'НЕТ ДАННЫХ';
            container.innerHTML = `<p style="color: var(--burgundy);">Папка проектов пуста или еще не запущен скрипт <b>build.py</b>.</p>`;
            console.error(err);
        });

    // 2. Отрисовка плашек на главной странице
    function renderProjectsGrid(projects) {
        counter.textContent = `ВСЕГО ТОМОВ: ${projects.length}`;
        container.innerHTML = '';

        projects.forEach((proj, index) => {
            const card = document.createElement('article');
            card.className = 'project-card';

            const coverSrc = proj.cover
                ? proj.cover
                : 'data:image/svg+xml;utf8,<svg xmlns="http://w3.org" width="400" height="250"><rect width="100%" height="100%" fill="%23EFEAE0"/><text x="50%" y="50%" font-family="serif" font-size="20" fill="%236E1E2A" text-anchor="middle">PDF Документация</text></svg>';

            card.innerHTML = `
                <div class="card-image-wrap">
                    <img src="${coverSrc}" alt="${proj.title}" loading="lazy">
                    <span class="card-count-badge">Листов: ${proj.files.length}</span>
                </div>
                <div class="card-body">
                    <div>
                        <h3 class="card-title">${proj.title}</h3>
                        <p class="card-desc">${proj.description}</p>
                    </div>
                    <span class="card-action">Открыть том →</span>
                </div>
            `;

            card.addEventListener('click', () => openProject(index));
            container.appendChild(card);
        });
    }

    // 3. Открытие книги выбранного проекта
    function openProject(projectIndex) {
        currentProject = projectsData[projectIndex];
        currentFileIndex = 0;

        viewerFolderId.textContent = `ПАПКА №${currentProject.id}`;
        viewerTitle.textContent = currentProject.title;

        renderThumbnails();
        renderCurrentSheet();

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }
    // 4. Отрисовка активного листа (PNG/JPG или PDF)
    function renderCurrentSheet() {
        if (!currentProject || !currentProject.files.length) return;

        const file = currentProject.files[currentFileIndex];
        viewerPageInfo.textContent = `Лист ${currentFileIndex + 1} из ${currentProject.files.length} (${file.name})`;

        // Перезапуск анимации перелистывания страницы
        sheetContainer.style.animation = 'none';
        sheetContainer.offsetHeight;
        sheetContainer.style.animation = null;

        if (file.type === 'pdf') {
            sheetContainer.innerHTML = `<iframe src="${file.path}#view=FitH" title="${file.name}"></iframe>`;
        } else {
            sheetContainer.innerHTML = `<img src="${file.path}" alt="${file.name}">`;
        }

        // Подсветка активной миниатюры
        document.querySelectorAll('.thumb-item').forEach((el, idx) => {
            el.classList.toggle('active', idx === currentFileIndex);
        });
    }

    // 5. Лента миниатюр внизу просмотрщика
    function renderThumbnails() {
        thumbsContainer.innerHTML = '';
        currentProject.files.forEach((file, idx) => {
            const thumb = document.createElement('div');
            thumb.className = 'thumb-item';
            thumb.title = file.name;

            if (file.type === 'pdf') {
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

    // 6. Навигация и закрытие
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

    // Управление стрелками и Esc с клавиатуры
    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('active')) return;
        if (e.key === 'Escape') closeViewer();
        if (e.key === 'ArrowRight') nextSheet();
        if (e.key === 'ArrowLeft') prevSheet();
    });
});
