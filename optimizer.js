window.PortfolioOptimizer = (() => {
    const CACHE_KEY = 'portfolio_manifest_cache_v1';
    const HASH_KEY = 'portfolio_manifest_hash_v1';
    const POLL_INTERVAL = 15000; // Проверка обновлений каждые 15 секунд
    let currentHash = localStorage.getItem(HASH_KEY) || '';
    let pollTimer = null;

    // Быстрый расчет контрольной суммы JSON, чтобы не перерисовывать DOM без причины
    function computeHash(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return hash.toString(36);
    }

    // Мгновенная выдача из кэша (0 мс задержки при открытии сайта)
    function getCachedManifest() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    // Тихая фоновая проверка свежей версии manifest.json
    async function checkUpdates(onUpdateCallback) {
        if (document.hidden) return; // Не тратим трафик, если вкладка свернута

        try {
            const res = await fetch(`manifest.json?t=${Date.now()}`, {
                cache: 'no-store',
                priority: 'low'
            });
            if (!res.ok) return;

            const rawText = await res.text();
            const newHash = computeHash(rawText);

            if (newHash !== currentHash) {
                const parsedData = JSON.parse(rawText);
                currentHash = newHash;
                localStorage.setItem(CACHE_KEY, rawText);
                localStorage.setItem(HASH_KEY, newHash);

                if (typeof onUpdateCallback === 'function') {
                    onUpdateCallback(parsedData, true);
                }
            }
        } catch (err) {
            // Тихо игнорируем сетевые сбои, сайт продолжает работать из кэша
        }
    }
    // Предзагрузка соседних картинок в фоне (чтобы перелистывание было моментальным)
    function prefetchAdjacentSheets(files, currentIndex) {
        if (!files || files.length < 2) return;

        const nextIdx = (currentIndex + 1) % files.length;
        const prevIdx = (currentIndex - 1 + files.length) % files.length;

        [nextIdx, prevIdx].forEach(idx => {
            const file = files[idx];
            if (file && file.type === 'image') {
                const img = new Image();
                img.decoding = 'async';
                img.src = file.path;
            }
        });
    }

    // Ленивая подгрузка 3D-движка Google Model-Viewer только при открытии 3D-файла
    let modelViewerPromise = null;
    function ensure3DEngine() {
        if (customElements.get('model-viewer')) {
            return Promise.resolve();
        }
        if (!modelViewerPromise) {
            modelViewerPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.type = 'module';
                script.src = 'https://googleapis.com';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        return modelViewerPromise;
    }

    // Запуск фонового наблюдателя
    function startLiveSync(onUpdateCallback) {
        checkUpdates(onUpdateCallback);
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => checkUpdates(onUpdateCallback), POLL_INTERVAL);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) checkUpdates(onUpdateCallback);
        });
    }

    return {
        getCachedManifest,
        startLiveSync,
        prefetchAdjacentSheets,
        ensure3DEngine
    };
})();
