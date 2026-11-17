import os
import json
import hashlib

PROJECTS_DIR = 'project'
OUTPUT_FILE = 'manifest.json'

IMAGE_EXT = {'.png', '.jpg', '.jpeg', '.webp'}
MODEL_EXT = {'.glb', '.gltf'}
PDF_EXT = {'.pdf'}
ALLOWED_EXT = IMAGE_EXT | MODEL_EXT | PDF_EXT


def get_file_size_mb(filepath):
    size_bytes = os.path.getsize(filepath)
    return round(size_bytes / (1024 * 1024), 2)


def scan_projects():
    projects = []
    if not os.path.exists(PROJECTS_DIR):
        os.makedirs(PROJECTS_DIR)

    # Сортируем папки: числовые по возрастанию (1, 2, 10), текстовые по алфавиту
    folders = sorted(
        [f for f in os.listdir(PROJECTS_DIR) if os.path.isdir(os.path.join(PROJECTS_DIR, f))],
        key=lambda x: (0, int(x)) if x.isdigit() else (1, x.lower())
    )

    for folder in folders:
        folder_path = os.path.join(PROJECTS_DIR, folder)
        files = []
        cover = None
        has_3d = False
        has_pdf = False

        # Сортируем файлы внутри папки так, чтобы обложка и 3D-модель были в начале
        raw_files = sorted(os.listdir(folder_path))

        for file in raw_files:
            full_path = os.path.join(folder_path, file)
            if not os.path.isfile(full_path):
                continue

            ext = os.path.splitext(file)[1].lower()
            if ext not in ALLOWED_EXT:
                continue

            rel_path = f"{PROJECTS_DIR}/{folder}/{file}"
            size_mb = get_file_size_mb(full_path)

            if ext in MODEL_EXT:
                file_type = "3d"
                has_3d = True
            elif ext in PDF_EXT:
                file_type = "pdf"
                has_pdf = True
            else:
                file_type = "image"

            files.append({
                "name": file,
                "path": rel_path,
                "type": file_type,
                "sizeMb": size_mb
            })

            # Определяем главную обложку карточки
            if file_type == "image":
                name_lower = file.lower()
                if cover is None or any(k in name_lower for k in ("cover", "main", "00", "01", "render")):
                    if cover is None or not any(k in cover.lower() for k in ("cover", "main")):
                        cover = rel_path

        # Читаем название, описание и теги из info.txt (если файл есть в папке)
        title = f"Проект №{folder}" if folder.isdigit() else folder
        desc = "Архитектурные решения, конструктив и инженерные сети"
        tags = []

        info_path = os.path.join(folder_path, 'info.txt')
        if os.path.exists(info_path):
            with open(info_path, 'r', encoding='utf-8') as f:
                lines = [line.strip() for line in f.readlines() if line.strip()]
                if len(lines) >= 1:
                    title = lines[0]
                if len(lines) >= 2:
                    desc = lines[1]
                if len(lines) >= 3:
                    tags = [t.strip() for t in lines[2].split(',') if t.strip()]

        if files:
            projects.append({
                "id": folder,
                "title": title,
                "description": desc,
                "tags": tags,
                "cover": cover,
                "has3d": has_3d,
                "hasPdf": has_pdf,
                "files": files
            })

    # Формируем итоговый JSON с хешем для мгновенной проверки обновлений в optimizer.js
    payload_str = json.dumps(projects, ensure_ascii=False, indent=2)
    version_hash = hashlib.md5(payload_str.encode('utf-8')).hexdigest()[:12]

    final_output = {
        "version": version_hash,
        "count": len(projects),
        "projects": projects
    }

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)

    print(f"Сборка завершена! Проектов: {len(projects)} | Версия кэша: {version_hash}")


if __name__ == '__main__':
    scan_projects()
