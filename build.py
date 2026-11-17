import os
import json

PROJECTS_DIR = 'project'
OUTPUT_FILE = 'manifest.json'
ALLOWED_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.pdf'}

def scan_projects():
    projects = []
    if not os.path.exists(PROJECTS_DIR):
        os.makedirs(PROJECTS_DIR)

    # Сортируем папки (если названия числовые, сортируем как числа)
    folders = sorted(
        [f for f in os.listdir(PROJECTS_DIR) if os.path.isdir(os.path.join(PROJECTS_DIR, f))],
        key=lambda x: int(x) if x.isdigit() else x
    )

    for folder in folders:
        folder_path = os.path.join(PROJECTS_DIR, folder)
        files = []
        cover = None

        for file in sorted(os.listdir(folder_path)):
            ext = os.path.splitext(file)[1].lower()
            if ext in ALLOWED_EXT:
                rel_path = f"{PROJECTS_DIR}/{folder}/{file}"
                files.append({
                    "name": file,
                    "path": rel_path,
                    "type": "pdf" if ext == ".pdf" else "image"
                })
                # Ищем обложку или берем первое изображение
                if ext != ".pdf" and (cover is None or "cover" in file.lower() or "main" in file.lower()):
                    cover = rel_path

        # Читаем опциональное описание, если есть info.txt
        title = f"Проект №{folder}" if folder.isdigit() else folder
        desc = "Архитектурные решения и инженерные сети"
        info_path = os.path.join(folder_path, 'info.txt')
        if os.path.exists(info_path):
            with open(info_path, 'r', encoding='utf-8') as f:
                lines = [line.strip() for line in f.readlines() if line.strip()]
                if len(lines) > 0: title = lines[0]
                if len(lines) > 1: desc = " ".join(lines[1:])

        if files:
            projects.append({
                "id": folder,
                "title": title,
                "description": desc,
                "cover": cover,
                "files": files
            })

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(projects, f, ensure_ascii=False, indent=2)
    print(f"Готово! Найдено проектов: {len(projects)}")

if __name__ == '__main__':
    scan_projects()
