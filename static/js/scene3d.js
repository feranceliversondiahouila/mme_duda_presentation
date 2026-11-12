// Initialisation de Three.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- ZONES D'INTÉRÊT (POI) ---
// Pour en ajouter une : une ligne ici + la même "id" dans POIS de server.py (titre + description)
const POIS = [
    { id: 'baie_brassage', x: -7, z: -8.5, radius: 3.0 }
];
const POI_LEAVE_MARGIN = 0.5; // Marge pour éviter que le bouton clignote à la limite de la zone

// Limites de la salle (les avatars ne sortent pas)
const ROOM_LIMITS = { minX: -11, maxX: 11, minZ: -9.5, maxZ: 14 };

export class SceneIUT {
    constructor(socket, onZoomComplete) {
        this.socket = socket; // Socket partagé, fourni par app.js
        this.container = document.getElementById('webgl-container');
        this.onZoomComplete = onZoomComplete; 
        this.isZooming = false;
        
        this.playersInScene = {}; // Avatars des joueurs
        this.studentDesks = [];   // Liste des bureaux générés dynamiquement
        
        this.clock = new THREE.Clock();
        this.poiLights = [];      // Lumières qui clignotent sur les équipements

        this.initScene();
        this.buildRoom();      // Murs, sol, baie de brassage
        this.createProfDesk(); // Le bureau principal avec le PC
        this.initSocketEvents(); // Connexion au serveur WebSockets
        this.animate();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x05070d); // Fond bleu/noir très sombre
        this.scene.fog = new THREE.Fog(0x05070d, 25, 70);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        // Caméra FIXE en vue plongeante : on voit toute la salle, ce sont les avatars qui bougent
        // (une caméra pilotée par 15 joysticks donnerait le mal de mer à la salle)
        this.camera.position.set(0, 9, 19);
        this.lookTarget = new THREE.Vector3(0, 0, 1);
        this.camera.lookAt(this.lookTarget);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        // Lumières Cyberpunk
        const ambient = new THREE.AmbientLight(0xffffff, 0.3);
        const neonBleu = new THREE.PointLight(0x00ccff, 2, 15);
        neonBleu.position.set(-3, 4, -2);
        const neonVert = new THREE.PointLight(0x00ff66, 2, 15);
        neonVert.position.set(3, 4, 5);
        
        this.scene.add(ambient, neonBleu, neonVert);

        // Sol quadrillé
        const grid = new THREE.GridHelper(24, 48, 0x00ff66, 0x113322);
        grid.position.set(0, 0.01, 2); // Légèrement au-dessus du sol pour éviter le scintillement
        this.scene.add(grid);
    }

    // --- LA SALLE DE L'IUT (générée en code, sans Blender) ---
    buildRoom() {
        // Sol (24 x 26, centré sur z = 2 : de z = -11 à z = 15)
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(24, 26),
            new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.8 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, 2);
        this.scene.add(floor);

        // Murs (bleu nuit) : fond + côtés. Le devant reste ouvert pour la caméra.
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(24, 5, 0.5), wallMat);
        backWall.position.set(0, 2.5, -11);
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 26), wallMat);
        leftWall.position.set(-12, 2.5, 2);
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 26), wallMat);
        rightWall.position.set(12, 2.5, 2);
        this.scene.add(backWall, leftWall, rightWall);

        // Éclairage d'ambiance
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const roomLight = new THREE.PointLight(0x00ccff, 1.5, 40);
        roomLight.position.set(0, 6, 2);
        this.scene.add(roomLight);
        // Néon vert type matrice, au fond de la salle
        const neonLight = new THREE.PointLight(0x00ff66, 1.5, 20);
        neonLight.position.set(0, 6, -5);
        this.scene.add(neonLight);

        // Baie de brassage (équipement important, coin au fond à gauche)
        const rackPoi = POIS.find(p => p.id === 'baie_brassage');
        this.serverRack = new THREE.Mesh(
            new THREE.BoxGeometry(2, 4.5, 1.5),
            new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 })
        );
        this.serverRack.position.set(rackPoi.x, 2.25, rackPoi.z);
        this.scene.add(this.serverRack);

        // LED verte d'activité (clignote) + LED rouge fixe
        const rackLight = new THREE.PointLight(0x00ff00, 1, 4);
        rackLight.position.set(rackPoi.x, 2, rackPoi.z + 1.2);
        this.scene.add(rackLight);
        this.poiLights.push(rackLight);

        const ledLight = new THREE.PointLight(0xff3333, 2, 5);
        ledLight.position.set(rackPoi.x, 4, rackPoi.z + 1.2);
        this.scene.add(ledLight);

        // Cercle lumineux au sol : montre aux joueurs jusqu'où s'approcher
        for (const poi of POIS) {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(poi.radius - 0.1, poi.radius, 64),
                new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(poi.x, 0.02, poi.z);
            this.scene.add(ring);
        }
    }

    // --- RADAR DE PROXIMITÉ : qui est près d'un équipement ? ---
    checkProximity() {
        for (const pseudo in this.playersInScene) {
            const player = this.playersInScene[pseudo];
            if (player.state !== "waiting") continue; // Plus de POI une fois la présentation lancée

            // Distance à plat (on ignore la hauteur : l'avatar est au sol, la baie fait 3 m)
            const nearest = this.findNearestPoi(player.mesh.position, player.nearPoi);

            if (nearest !== player.nearPoi) {
                if (player.nearPoi) {
                    this.socket.emit('trigger_poi', { pseudo, poi: player.nearPoi, action: 'hide' });
                }
                if (nearest) {
                    this.socket.emit('trigger_poi', { pseudo, poi: nearest, action: 'show' });
                }
                player.nearPoi = nearest;
            }
        }
    }

    // Renvoie l'id de la POI la plus proche dans sa zone (ou null). Marge de sortie si on y est déjà.
    findNearestPoi(position, currentPoi) {
        let best = null;
        let bestDist = Infinity;
        for (const poi of POIS) {
            const dist = Math.hypot(position.x - poi.x, position.z - poi.z);
            const limit = poi.radius + (poi.id === currentPoi ? POI_LEAVE_MARGIN : 0);
            if (dist < limit && dist < bestDist) {
                best = poi.id;
                bestDist = dist;
            }
        }
        return best;
    }

    // Garde une cible de déplacement à l'intérieur de la salle
    clampToRoom(player) {
        player.targetX = Math.min(ROOM_LIMITS.maxX, Math.max(ROOM_LIMITS.minX, player.targetX));
        player.targetZ = Math.min(ROOM_LIMITS.maxZ, Math.max(ROOM_LIMITS.minZ, player.targetZ));
    }

    createProfDesk() {
        // Bureau du prof (Cible finale)
        const deskGeo = new THREE.BoxGeometry(2, 0.8, 1);
        const deskMat = new THREE.MeshStandardMaterial({ color: 0x222233 });
        const desk = new THREE.Mesh(deskGeo, deskMat);
        desk.position.set(0, 0.4, 0);
        this.scene.add(desk);

        // Écran de PC 
        const screenGeo = new THREE.BoxGeometry(1, 0.6, 0.05);
        const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x002211 });
        this.pcScreen = new THREE.Mesh(screenGeo, screenMat);
        this.pcScreen.position.set(0, 1.1, 0);
        this.scene.add(this.pcScreen);
    }

    // --- LOGIQUE MULTIJOUEUR (WEBSOCKETS) ---
    initSocketEvents() {
        // 1. Un joueur rejoint : On crée un bureau et son avatar
        this.socket.on('player_joined', (playerData) => {
            console.log(`>> [RESEAU] ${playerData.pseudo} connecté.`);
            this.spawnStudentDesk();
            this.spawnPlayer(playerData);
            
            // Met à jour le compteur sur l'écran géant
            const counter = document.getElementById('player-count');
            if (counter) counter.innerText = Object.keys(this.playersInScene).length;
        });

        // 2. Un joueur bouge son joystick
        this.socket.on('player_moved', (playerData) => {
            if (this.playersInScene[playerData.pseudo] && this.playersInScene[playerData.pseudo].state === "waiting") {
                // Modifie la vitesse de déplacement ici si besoin
                this.playersInScene[playerData.pseudo].targetX += playerData.x * 0.15;
                this.playersInScene[playerData.pseudo].targetZ -= playerData.y * 0.15;
                this.clampToRoom(this.playersInScene[playerData.pseudo]);
            }
        });

        // 3. Iverson clique sur "LANCER LA PRESENTATION"
        this.socket.on('force_sit_all', () => {
            console.log(">> [ADMIN] Lancement de la cinématique Auto-Sit !");
            
            // Cache le gros QR Code
            const lobby = document.getElementById('lobby-screen');
            if (lobby) lobby.style.display = 'none';

            // Ordonne à tous les joueurs de marcher vers leur bureau respectif
            let i = 0;
            for (const pseudo in this.playersInScene) {
                const player = this.playersInScene[pseudo];
                player.state = "walking_to_desk";
                
                // Assigne un bureau existant (le 1er joueur a le 1er bureau, etc.)
                const myDeskPos = this.studentDesks[i].position;
                player.deskTarget = new THREE.Vector3(myDeskPos.x, 0.8, myDeskPos.z + 0.5); // Devant le bureau
                i++;
            }

            // Après 4 secondes (le temps qu'ils s'assoient), on zoome dans le PC
            setTimeout(() => {
                this.startZoomIntoPC();
            }, 4000);
        });
    }

    // --- GÉNÉRATION DYNAMIQUE ---
    spawnStudentDesk() {
        const count = this.studentDesks.length;
        const col = count % 3; // 3 bureaux par rangée
        const row = Math.floor(count / 3);
        
        const deskGeo = new THREE.BoxGeometry(1.2, 0.7, 0.6);
        const deskMat = new THREE.MeshStandardMaterial({ color: 0x1a2530 });
        const desk = new THREE.Mesh(deskGeo, deskMat);
        
        // Placement mathématique en forme de classe
        desk.position.set(-2.5 + (col * 2.5), 0.35, 3 + (row * 2));
        
        this.scene.add(desk);
        this.studentDesks.push(desk);
    }

    spawnPlayer(playerData) {
        // On s'assure que GLTFLoader est bien disponible
        // (Vérifie qu'il est importé en haut de ton fichier scene3d.js)
        const gltfLoader = new GLTFLoader(); 
        
        gltfLoader.load('/static/models/avatar.glb', (gltf) => {
            const avatarMesh = gltf.scene;

            // 1. Ajuste l'échelle de ton modèle si nécessaire
            avatarMesh.scale.set(1, 1, 1); 

            // 2. Traitement de la texture du visage
            if (playerData.photo_url && !playerData.photo_url.includes('default')) {
                const textureLoader = new THREE.TextureLoader();
                
                // On charge l'image générée par OpenCV
                textureLoader.load(playerData.photo_url, (faceTexture) => {
                    faceTexture.flipY = false; // Corrige l'inversion liée au format GLTF
                    faceTexture.colorSpace = THREE.SRGBColorSpace; // Pour garder les bonnes couleurs

                    // 3. On cherche la tête dans le modèle 3D
                    avatarMesh.traverse((child) => {
                        if (child.isMesh) {
                            const partName = child.name.toLowerCase();
                            
                            // Si c'est la tête ou le visage
                            if (partName.includes("head") || partName.includes("face") || partName.includes("wolf3d_head")) {
                                // On clone le matériau pour que chaque joueur ait son propre visage
                                child.material = child.material.clone();
                                child.material.map = faceTexture;
                                child.material.needsUpdate = true;
                            }
                        }
                    });
                });
            }

            // 4. Placement aléatoire dans la salle
            const startX = -3 + (Math.random() * 6);
            const startZ = 8 + (Math.random() * 2);
            
            avatarMesh.position.set(startX, 0, startZ);
            avatarMesh.rotation.y = Math.PI; // Fait tourner le perso vers la caméra

            // 5. Ajout d'une lumière rouge si c'est l'Admin (Iverson)
            if (playerData.is_admin) {
                const adminLight = new THREE.PointLight(0xff3333, 1.5, 3);
                adminLight.position.set(0, 2.2, 0); 
                avatarMesh.add(adminLight);
            }

            this.scene.add(avatarMesh);

            this.playersInScene[playerData.pseudo] = {
                mesh: avatarMesh,
                state: "waiting",
                targetX: startX,
                targetZ: startZ
            };

        }, undefined, (error) => {
            console.error("Erreur de chargement de l'avatar GLB :", error);
            // Si le modèle plante, on lance la capsule de secours (que Claude a préparée)
            if (typeof this.spawnCapsuleFallback === "function") {
                this.spawnCapsuleFallback(playerData);
            }
        });
    }

    // --- CINÉMATIQUES ---
    startZoomIntoPC() {
        this.isZooming = true;
        this.targetCameraPos = new THREE.Vector3(0, 1.1, 0.05); // Exactement dans l'écran
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // 1. Déplacements libres au joystick ou Auto-Sit
        for (const pseudo in this.playersInScene) {
            const player = this.playersInScene[pseudo];
            const mesh = player.mesh;

            if (player.state === "waiting") {
                // Lerp fluide vers la cible du joystick
                mesh.position.x += (player.targetX - mesh.position.x) * 0.1;
                mesh.position.z += (player.targetZ - mesh.position.z) * 0.1;
            } 
            else if (player.state === "walking_to_desk") {
                // Lerp fluide vers le bureau assigné
                mesh.position.lerp(player.deskTarget, 0.05);
            }
        }

        // 1 bis. Radar : bouton "Voir plus" sur les téléphones proches d'un équipement
        this.checkProximity();

        // Lumières des équipements qui clignotent
        const t = this.clock.getElapsedTime();
        this.poiLights.forEach((light, i) => {
            light.intensity = 1 + 0.6 * Math.sin(t * 4 + i);
        });

        // 2. Zoom de la caméra dans l'écran du prof
        if (this.isZooming) {
            this.camera.position.lerp(this.targetCameraPos, 0.03);
            // La caméra regarde de plus en plus vers l'écran pendant qu'elle avance
            this.lookTarget.lerp(this.pcScreen.position, 0.03);
            this.camera.lookAt(this.lookTarget);
            
            // Quand on rentre dans l'écran, on coupe la 3D
            if (this.camera.position.distanceTo(this.targetCameraPos) < 0.1) {
                this.isZooming = false;
                this.container.classList.add('hidden'); 
                this.onZoomComplete(); // Déclenche le terminal Cyberpunk (app.js)
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
    // Avatar de secours (capsule) si le .glb ne se charge pas
    spawnCapsuleFallback(playerData) {
        const textureLoader = new THREE.TextureLoader();
        const faceTexture = textureLoader.load(playerData.photo_url);
        
        const geo = new THREE.CapsuleGeometry(0.3, 0.8, 16, 32);
        const mat = new THREE.MeshStandardMaterial({ 
            map: faceTexture,
            color: 0xffffff,
            roughness: 0.6
        });
        
        const avatarMesh = new THREE.Mesh(geo, mat);
        
        const startX = -3 + (Math.random() * 6);
        const startZ = 8 + (Math.random() * 2);
        avatarMesh.position.set(startX, 0.7, startZ);
        
        if (playerData.is_admin) {
            const adminLight = new THREE.PointLight(0xff3333, 1, 2);
            adminLight.position.set(0, 1, 0);
            avatarMesh.add(adminLight);
        }
        
        this.scene.add(avatarMesh);
        
        this.playersInScene[playerData.pseudo] = {
            mesh: avatarMesh,
            state: "waiting",
            targetX: startX,
            targetZ: startZ
        };
    }
}
