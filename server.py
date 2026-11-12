from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import qrcode
import socket
import os
import time
import base64
from skin_modeler import generate_uv_texture

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['SECRET_KEY'] = 'netrunner_key'

socketio = SocketIO(app, cors_allowed_origins="*")

def get_admins():
    """Lit la liste des admins depuis le fichier texte"""
    try:
        with open('admins.txt', 'r', encoding='utf-8') as f:
            # Récupère chaque ligne en enlevant les espaces invisibles et sauts de ligne
            return [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        # Sécurité : si le fichier n'existe pas encore, Iverson reste admin de secours
        return ["Iverson"]

# Lien Ngrok (Laisse vide pour les tests en local Wi-Fi)
PUBLIC_URL = "https://running-dividend-slingshot.ngrok-free.dev" 

# État global de la partie
game_state = {
    "status": "waiting", # "waiting" (salle d'attente) ou "presentation"
    "players": {}
}

# Équipements de la salle (zones d'intérêt). L'"id" doit être la même que dans POIS de scene3d.js.
POIS = {
    "baie_brassage": {
        "title": "BAIE DE BRASSAGE",
        "description": "Contient le Switch Core Cisco 2960 et le routeur de bordure reliant notre réseau au FAI."
    }
}

# Pseudo -> identifiant Socket.IO du téléphone (pour envoyer un message à UN seul joueur)
player_sids = {}
# Pseudo du joueur dont la fenêtre "Voir plus" est affichée sur le vidéoprojecteur
poi_viewer = {"pseudo": None}

# Historique des étapes diffusées aux téléphones (pour les retardataires / reconnexions)
progress_log = []

def push_progress(step):
    """Mémorise l'étape et la diffuse à tous les téléphones"""
    progress_log.append(step)
    emit('sync_progress', {'step': step}, broadcast=True)

def get_local_ip():
    """Détecte l'IP locale du PC"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def generate_qr_code():
    """Génère le QR Code pointant vers la page /join avec Ngrok ou l'IP locale"""
    base_url = PUBLIC_URL if PUBLIC_URL != "" else f"http://{get_local_ip()}:5000"
    join_url = f"{base_url}/join"
    
    os.makedirs('static/images', exist_ok=True)
    qr = qrcode.make(join_url)
    qr.save("static/images/qrcode.png")
    return join_url

# --- ROUTES CLASSIQUES (HTTP) ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/join')
def join():
    return render_template('join.html')

@app.route('/api/spawn', methods=['POST'])
def spawn_player():
    """Reçoit les 5 photos biométriques et le pseudo"""
    pseudo = request.form.get('pseudo', 'Inconnu').strip()
    use_default = request.form.get('use_default') == 'true'
    
    photo_url = "/static/images/default_avatar.png" # Avatar par défaut
    
    if not use_default:
        # Récupération des 5 images Base64
        img_front = request.form.get('img_front')
        img_left = request.form.get('img_left')
        img_right = request.form.get('img_right')
        img_up = request.form.get('img_up')
        img_down = request.form.get('img_down')
        
        # Si on a bien reçu des images du scanner
        if img_front and img_left and img_right:
            images_b64 = [img_front, img_left, img_right, img_up, img_down]
            
            # Appel au script OpenCV pour fusionner les visages
            photo_url = generate_uv_texture(pseudo, images_b64, app.config['UPLOAD_FOLDER'])
        
        # TODO plus tard : utiliser img_left, img_right, img_up, img_down avec OpenCV
        
    # Enregistrement du joueur
    is_admin = pseudo in get_admins()
    game_state["players"][pseudo] = {
        "pseudo": pseudo,
        "photo_url": photo_url,
        "is_admin": is_admin,
        "x": 0, "y": 0, # Position pour le joystick
        "state": "waiting"
    }
    
    # Prévient la scène 3D (le projecteur) d'ajouter un bureau et ce joueur
    socketio.emit('player_joined', game_state["players"][pseudo])
    
    return jsonify({"status": "ok", "player": game_state["players"][pseudo]})

# --- ROUTES TEMPS RÉEL (WEBSOCKETS) ---

@socketio.on('move_joystick')
def handle_movement(data):
    """Reçoit les coordonnées du joystick"""
    if game_state["status"] != "waiting":
        return # Bloque les mouvements si la présentation a commencé
        
    pseudo = data.get('pseudo')
    if pseudo in game_state["players"]:
        game_state["players"][pseudo]["x"] = data.get('x')
        game_state["players"][pseudo]["y"] = data.get('y')
        
        # Renvoie la nouvelle position à l'écran 3D principal
        emit('player_moved', game_state["players"][pseudo], broadcast=True)

@socketio.on('register_player')
def handle_register_player(data):
    """Le téléphone dit « je suis ce pseudo » : on retient son identifiant pour lui parler en privé"""
    pseudo = data.get('pseudo')
    if pseudo in game_state["players"]:
        player_sids[pseudo] = request.sid

@socketio.on('disconnect')
def handle_disconnect(*args):
    for pseudo, sid in list(player_sids.items()):
        if sid == request.sid:
            del player_sids[pseudo]

@socketio.on('trigger_poi')
def handle_trigger_poi(data):
    """Le PC dit qu'un joueur est (plus) près d'un équipement : on prévient SON téléphone uniquement"""
    if game_state["status"] != "waiting":
        return
    pseudo = data.get('pseudo')
    poi_id = data.get('poi')
    poi = POIS.get(poi_id)
    sid = player_sids.get(pseudo)
    if not poi or not sid:
        return
    emit('poi_update', {
        'poi': poi_id,
        'action': data.get('action'),  # 'show' ou 'hide'
        'title': poi['title'],
        'description': poi['description']
    }, to=sid)

@socketio.on('open_pc_modal')
def handle_open_pc_modal(data):
    """Un joueur a cliqué sur « Voir plus » : on affiche aussi la fenêtre sur le vidéoprojecteur"""
    poi_id = data.get('poi')
    poi = POIS.get(poi_id)
    if not poi or game_state["status"] != "waiting":
        return
    poi_viewer["pseudo"] = data.get('pseudo')
    emit('pc_show_poi', {
        'poi': poi_id,
        'title': poi['title'],
        'description': poi['description'],
        'pseudo': data.get('pseudo')
    }, broadcast=True)

@socketio.on('close_pc_modal')
def handle_close_pc_modal(data):
    """Fermeture de la fenêtre (X sur le téléphone ou X sur le PC)"""
    source = data.get('source')  # 'phone' ou 'pc'
    viewer = poi_viewer["pseudo"]

    # Un autre joueur ferme SA fenêtre alors que le PC affiche celle de quelqu'un d'autre : on ne touche pas au PC
    if source == 'phone' and data.get('pseudo') != viewer:
        return

    poi_viewer["pseudo"] = None
    emit('pc_hide_poi', broadcast=True)
    # Si c'est le PC qui ferme, on ferme aussi la fenêtre sur le téléphone concerné
    if source == 'pc' and viewer in player_sids:
        emit('poi_close', to=player_sids[viewer])

@socketio.on('pc_ready')
def handle_pc_ready():
    """Le vidéoprojecteur (re)charge sa page : on lui renvoie les joueurs déjà connectés"""
    for player in game_state["players"].values():
        emit('player_joined', player)  # Uniquement à l'émetteur (le PC)

@socketio.on('request_progress')
def handle_request_progress():
    """Un téléphone (nouveau ou reconnecté) demande l'historique des étapes déjà passées"""
    emit('progress_history', {'steps': list(progress_log)})

@socketio.on('admin_action')
def handle_admin_action(data):
    """Reçoit les clics de la télécommande Admin et gère la logique de la présentation"""
    pseudo = data.get('pseudo')
    action = data.get('action')
    
    if pseudo in get_admins():
        print(f">>> [ADMIN {pseudo}] action : {action}")
        
        # 1. Gestion du QR Code
        if action == 'hide_qr' or action == 'show_qr':
            emit('presentation_control', {'action': action}, broadcast=True)
            
        # 2. Gestion de la présentation et du suivi utilisateur
        elif action == 'start_presentation':
            game_state["status"] = "presentation"
            progress_log.clear()
            poi_viewer["pseudo"] = None
            emit('pc_hide_poi', broadcast=True)
            emit('force_sit_all', broadcast=True)
            # Met à jour les téléphones des spectateurs
            push_progress('cinematic')
            
        elif action == 'next_point':
            emit('presentation_control', {'action': action}, broadcast=True)
            push_progress('datacenter')
            
        elif action == 'show_info':
            emit('presentation_control', {'action': action}, broadcast=True)
            push_progress('explication')
            
        elif action == 'validate_level':
            emit('presentation_control', {'action': action}, broadcast=True)
            push_progress('victory')

        elif action == 'end_presentation':
            # Retour au lobby : le PC recharge sa page, les téléphones retrouvent leur joystick
            game_state["status"] = "waiting"
            progress_log.clear()
            emit('presentation_control', {'action': action}, broadcast=True)
            emit('sync_progress', {'step': 'end'}, broadcast=True)

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    join_url = generate_qr_code()
    print(f"=================================================")
    print(f"🌐 SERVEUR NETRUNNER ACTIF")
    print(f"📺 Vidéoprojecteur (PC) : http://localhost:5000")
    print(f"📱 Smartphones (URL du QR) : {join_url}")
    print(f"=================================================")
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)