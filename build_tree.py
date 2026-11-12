import os

# 1. Définition des dossiers (Architecture Flask standard)
folders = [
    "templates",
    "static/css",
    "static/js",
    "static/models",
    "static/videos",
    "static/images",
    "static/uploads",
    "static/skins"
]

# 2. Définition des fichiers et de leur contenu de base
files = {
    # Backend (Racine)
    "server.py": "# Serveur Flask principal (Gère les connexions et l'API)\n",
    "skin_modeler.py": "# Script OpenCV (Génération des textures et du relief du visage)\n",
    "requirements.txt": "flask\nopencv-python\nnumpy\n",
    "README.md": "# Présentation Data Center (Cyberpunk & 3D Interactive)\n\n## Installation\n`pip install -r requirements.txt`\n`python server.py`\n",
    
    # Frontend HTML (Dossier templates)
    "templates/index.html": "<!-- Écran Vidéoprojecteur (Scène 3D, Terminal, Carte Data Center) -->\n",
    "templates/join.html": "<!-- Écran Mobile (Interface de création de Skin pour les collègues) -->\n",
    
    # Frontend CSS (Dossier static/css)
    "static/css/main.css": "/* Grille principale, HUD et Responsive plein écran */\n",
    "static/css/cyberpunk-crt.css": "/* Effet écran cathodique, couleurs néon, scanlines */\n",
    "static/css/map-animations.css": "/* Zoom CSS et effets radar sur la carte du Data Center */\n",
    
    # Frontend JS (Dossier static/js)
    "static/js/app.js": "// Machine à états (Passe de la 3D au Terminal puis à la Carte)\n",
    "static/js/scene3d.js": "// Initialisation de Three.js (IUT, Chaises, Caméra)\n",
    "static/js/malleable-skin.js": "// Injection du skin OpenCV sur le modèle 3D .glb\n",
    "static/js/terminal.js": "// Logique des commandes réseau et synchronisation vidéo\n",
    "static/js/simulator.js": "// Jauges de budget (€), PUE et températures\n",
    
    # Gitkeeps pour que Git sauvegarde les dossiers vides
    "static/models/.gitkeep": "",
    "static/videos/.gitkeep": "",
    "static/images/.gitkeep": "",
    "static/uploads/.gitkeep": "",
    "static/skins/.gitkeep": ""
}

# 3. Création de l'arborescence
print("🚀 Initialisation du projet Cyber-DataCenter...\n")

for folder in folders:
    os.makedirs(folder, exist_ok=True)
    print(f"📁 Dossier créé : {folder}/")

for filepath, content in files.items():
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"📄 Fichier créé : {filepath}")

print("\n✅ Arborescence générée avec succès ! Tu peux supprimer ce script et initialiser Git.")