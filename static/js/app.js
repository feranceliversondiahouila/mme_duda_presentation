import { SceneIUT } from './scene3d.js';
import { SceneDataCenter } from './scene_datacenter.js';

// Connexion Socket.IO UNIQUE du vidéoprojecteur (partagée avec scene3d.js)
// Le PC ne fait qu'écouter : aucun code de joystick ni de scanner ici.
const socket = io();

// Variables globales
let myScene;
let dataCenterScene;

document.addEventListener("DOMContentLoaded", () => {
    console.log(">> Vidéoprojecteur prêt. Initialisation de la 3D...");
    
    // On lance la scène 3D en lui passant la fonction à exécuter quand le zoom se termine
    myScene = new SceneIUT(socket, triggerTerminalCinematic);

    // Redemande au serveur les joueurs déjà connectés (utile après le rechargement de fin de présentation)
    socket.emit('pc_ready');
});

// ==========================================
// 1. DÉCLENCHEMENT DU TERMINAL CYBERPUNK
// ==========================================
function triggerTerminalCinematic() {
    console.log(">> Zoom terminé. Lancement du Terminal.");
    
    // Afficher l'overlay du terminal (Couche 2)
    const terminalOverlay = document.getElementById('hud-overlay');
    terminalOverlay.classList.remove('hidden');
    
    // Lancer la frappe du texte au clavier
    startHackerTyping();
}

function startHackerTyping() {
    const typer = document.getElementById('auto-typer');
    const output = document.getElementById('terminal-output');
    
    const commandToType = "./trace_route --target datacenter_alpha --execute";
    let index = 0;
    
    const typeInterval = setInterval(() => {
        typer.textContent += commandToType.charAt(index);
        index++;
        
        if (index >= commandToType.length) {
            clearInterval(typeInterval);
            
            setTimeout(() => {
                document.querySelector('.cursor').style.display = 'none';
                typer.parentElement.innerHTML = `<span style="color: #ff3333;">root@admin-rt:~#</span> ${commandToType}`;
                displayTerminalLogs(output);
            }, 500);
        }
    }, 50);
}

function displayTerminalLogs(outputContainer) {
    const logs = [
        "Exécution du protocole de routage...",
        "Calcul des sauts OSPF... [OK]",
        "Passage par la passerelle par défaut : 192.168.1.254... [OK]",
        "Encapsulation des données en cours...",
        "Traversée du réseau opérateur et câble sous-marin...",
        "Ping de la cible : 12ms",
        ">> CONNEXION AU DATA CENTER ÉTABLIE <<"
    ];
    
    let i = 0;
    const logInterval = setInterval(() => {
        const p = document.createElement('p');
        p.textContent = logs[i];
        
        if (i === logs.length - 1) {
            p.style.color = "#fff";
            p.style.fontWeight = "bold";
            p.style.textShadow = "0 0 10px #fff";
        }
        
        outputContainer.appendChild(p);
        i++;
        
        if (i >= logs.length) {
            clearInterval(logInterval);
            setTimeout(() => {
                const waitMsg = document.createElement('p');
                waitMsg.style.color = "#ff3333";
                waitMsg.style.marginTop = "20px";
                waitMsg.textContent = ">> EN ATTENTE DE L'ADMINISTRATEUR POUR POURSUIVRE...";
                waitMsg.style.animation = "blink 1.5s infinite";
                outputContainer.appendChild(waitMsg);
            }, 1000);
        }
    }, 800);
}

// ==========================================
// 1 bis. FENÊTRE "VOIR PLUS" (équipements de la salle)
// ==========================================
const poiModal = document.getElementById('poi-modal');

// Un joueur a cliqué sur "Voir plus" sur son téléphone
socket.on('pc_show_poi', (data) => {
    document.getElementById('poi-modal-title').textContent = data.title;
    document.getElementById('poi-modal-text').textContent = data.description;
    document.getElementById('poi-modal-by').textContent = '>> Demandé par : ' + data.pseudo;
    poiModal.classList.remove('hidden');
});

socket.on('pc_hide_poi', () => poiModal.classList.add('hidden'));

// Fermeture depuis le PC (clic sur X ou touche Échap) : le serveur ferme aussi le téléphone concerné
function closePcModal() {
    poiModal.classList.add('hidden');
    socket.emit('close_pc_modal', { source: 'pc' });
}
document.getElementById('poi-modal-close').addEventListener('click', closePcModal);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !poiModal.classList.contains('hidden')) closePcModal();
});

// ==========================================
// 2. ÉCOUTE DE LA TÉLÉCOMMANDE ADMIN
// ==========================================
socket.on('presentation_control', (data) => {
    console.log(">> Ordre reçu de la télécommande Admin :", data.action);
    
    if (data.action === 'hide_qr') {
        document.getElementById('site-qrcode').style.display = 'none';
        document.getElementById('site-3d').classList.remove('hidden');
    }
    else if (data.action === 'show_qr') {
        document.getElementById('site-qrcode').style.display = 'flex';
    }
    else if (data.action === 'next_point') {
        document.getElementById('hud-overlay').classList.add('hidden');
        document.getElementById('webgl-container').classList.remove('hidden');
        
        if (!dataCenterScene) {
            dataCenterScene = new SceneDataCenter();
        }
        dataCenterScene.goToNextPoint();
    }
    else if (data.action === 'show_info') {
        const panel = document.getElementById('presentation-panel');
        panel.classList.remove('hidden');
    }
    else if (data.action === 'validate_level') {
        document.getElementById('presentation-panel').classList.add('hidden');
        const victoryScreen = document.getElementById('victory-screen');
        victoryScreen.classList.remove('hidden');
        
        if (typeof gsap !== 'undefined') {
            gsap.fromTo('.star', 
                { scale: 0, opacity: 0, rotation: -90 }, 
                { scale: 1, opacity: 1, rotation: 0, duration: 0.6, stagger: 0.2, ease: "back.out(1.7)" }
            );
        }
        setTimeout(() => {
            victoryScreen.classList.add('hidden');
        }, 3000);
    }
    else if (data.action === 'end_presentation') {
        console.log(">> Fin de la présentation. Retour au Lobby IUT.");
        // Rechargement : nettoie proprement la mémoire 3D du Data Center et recharge la salle de l'IUT
        window.location.reload();
    }
});