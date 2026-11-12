import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class SceneDataCenter {
    constructor() {
        this.container = document.getElementById('webgl-container');
        this.currentPointIndex = -1;
        
        // Les différents points de ton exposé (Niveaux)
        this.pointsOfInterest = [
            { title: "CŒUR RÉSEAU", camPos: { x: -5, y: 3, z: 5 }, lookAt: { x: -5, y: 1, z: 0 } },
            { title: "SALLE BLANCHE (SERVEURS)", camPos: { x: 0, y: 2, z: 4 }, lookAt: { x: 0, y: 1, z: -2 } },
            { title: "SYSTÈME DE REFROIDISSEMENT", camPos: { x: 5, y: 4, z: 5 }, lookAt: { x: 5, y: 0, z: 0 } }
        ];

        this.initScene();
        this.createPlaceholderModels();
    }

    initScene() {
        // On nettoie le conteneur (on enlève la salle de classe)
        this.container.innerHTML = '';
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050a15);
        this.scene.fog = new THREE.Fog(0x050a15, 2, 20);

        // Caméra de vue globale au démarrage
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 10, 10);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        // Lumières
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        const neonBleu = new THREE.PointLight(0x00ccff, 2, 20);
        neonBleu.position.set(0, 5, 0);
        this.scene.add(ambient, neonBleu);

        const grid = new THREE.GridHelper(40, 40, 0x00ccff, 0x112233);
        this.scene.add(grid);

        this.animate();
    }

    createPlaceholderModels() {
        // En attendant tes modèles Blender, on met des boîtes pour visualiser les zones
        const matReseau = new THREE.MeshStandardMaterial({ color: 0xff3333, wireframe: true });
        const meshReseau = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), matReseau);
        meshReseau.position.set(-5, 2, 0);
        
        const matServeur = new THREE.MeshStandardMaterial({ color: 0x00ff66, wireframe: true });
        const meshServeur = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 2), matServeur);
        meshServeur.position.set(0, 1.5, -2);
        
        const matFroid = new THREE.MeshStandardMaterial({ color: 0x00ccff, wireframe: true });
        const meshFroid = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), matFroid);
        meshFroid.position.set(5, 1, 0);

        this.scene.add(meshReseau, meshServeur, meshFroid);
    }

    // Fonction appelée par la télécommande Admin
    goToNextPoint() {
        this.currentPointIndex++;
        
        if (this.currentPointIndex >= this.pointsOfInterest.length) {
            console.log("Présentation terminée !");
            return; // TODO: Cinématique de fin globale
        }

        const target = this.pointsOfInterest[this.currentPointIndex];
        console.log(`>> Déplacement vers : ${target.title}`);

        // Le fameux mouvement de caméra fluide avec GSAP
        // 1. Déplacer la caméra
        gsap.to(this.camera.position, {
            x: target.camPos.x,
            y: target.camPos.y,
            z: target.camPos.z,
            duration: 2, // 2 secondes de vol
            ease: "power2.inOut"
        });

        // 2. Tourner la tête de la caméra pour regarder le bon endroit
        // (On utilise un objet temporaire pour que GSAP puisse animer l'angle)
        const dummy = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
        gsap.to(dummy, {
            x: target.lookAt.x,
            y: target.lookAt.y,
            z: target.lookAt.z,
            duration: 2,
            onUpdate: () => {
                this.camera.lookAt(target.lookAt.x, target.lookAt.y, target.lookAt.z);
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}