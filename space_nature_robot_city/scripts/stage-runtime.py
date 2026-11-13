"""Stage the current modular episode's native development scenes."""
from pathlib import Path
import json
import shutil
root = Path(__file__).resolve().parents[1]
repo = Path(json.loads((root / 'production.json').read_text())['repository'])
assert (repo / 'engine/src/scripting/EntityScriptModule.ts').is_file()
target = repo / '.local/robot-city'
target.mkdir(parents=True, exist_ok=True)
source = root / 'scripts/robot-city'
for pattern in ('*.ts', '*.mjs', '*.html', '*shots.json', '*positions.json'):
    for path in source.glob(pattern):
        shutil.copy2(path, target / path.name)
shutil.copytree(source / 'architecture', target / 'architecture', dirs_exist_ok=True)
review = target / 'review'
review.mkdir(exist_ok=True)
for name in ('scifi-city.bin', 'scifi-city.json', 'scifi-city-ownership.bin', 'scifi-construction.json'):
    shutil.copy2(root / 'models/architecture' / name, review / name)
for name in ('scifi-simulation.json', 'scifi-checkpoints.json', 'scifi-controller-preflight.json', 'scifi-navigation.json'):
    path = root / 'review' / name
    if path.exists():
        shutil.copy2(path, review / name)
for name in ('scifi-city-production.html', 'scifi-city-review.html'):
    shutil.copy2(source / name, repo / 'client' / name)
print(target)
