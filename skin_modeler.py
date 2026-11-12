# Script OpenCV (Génération des textures et du relief du visage)
import cv2
import numpy as np
import base64
import os

def decode_base64_image(b64_string):
    """Convertit l'image base64 du téléphone en matrice lisible par OpenCV"""
    if ',' in b64_string:
        b64_string = b64_string.split(',')[1]
    
    img_data = base64.b64decode(b64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

def generate_uv_texture(pseudo, images_b64, output_folder):
    """
    Prend les 5 images et les assemble pour créer une texture 3D (UV Map).
    images_b64 = [front, left, right, up, down]
    """
    print(f">> [BIOMÉTRIE] Traitement des scans de {pseudo}...")
    
    # 1. Décodage des 5 images
    imgs = [decode_base64_image(b64) for b64 in images_b64]
    
    # Redimensionnement standard (pour que toutes les têtes fassent la même taille)
    size = 256
    imgs = [cv2.resize(img, (size, size)) for img in imgs]
    front, left, right, up, down = imgs

    # 2. Création de la toile de fond (Canvas noir de 1024x512 pour la 3D)
    # Dans une texture de tête cylindrique : Gauche | Face | Droite | Arrière
    texture_w, texture_h = 1024, 512
    uv_map = np.zeros((texture_h, texture_w, 3), dtype=np.uint8)

    # 3. Collage des morceaux (Fusion simplifiée pour le MVP)
    # Face (Au centre)
    uv_map[128:384, 384:640] = front
    # Gauche 
    uv_map[128:384, 128:384] = left
    # Droite
    uv_map[128:384, 640:896] = right
    # Haut (Front/Cheveux)
    uv_map[0:128, 384:640] = cv2.resize(up, (256, 128))
    # Bas (Menton)
    uv_map[384:512, 384:640] = cv2.resize(down, (256, 128))
    
    # Lissage des bords (Blending) pour effacer les lignes de coupure
    uv_map = cv2.GaussianBlur(uv_map, (5, 5), 0)

    # 4. Sauvegarde de la texture générée
    filename = f"texture_{pseudo.replace(' ', '_')}.jpg"
    filepath = os.path.join(output_folder, filename)
    cv2.imwrite(filepath, uv_map)
    
    print(f">> [BIOMÉTRIE] Texture générée avec succès : {filepath}")
    return f"/{filepath}"