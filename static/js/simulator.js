// Jauges de budget (€), PUE et températures
export class DCSimulator {
    constructor() {
        this.budgetEl = document.getElementById('budget-value');
        this.pueEl = document.getElementById('pue-value');
        
        this.currentOpex = 25400; // Coût de départ par minute
        this.isGreenItActive = false;
        this.interval = null;

        this.initInteractions();
    }

    startSimulation() {
        // Fait monter le compteur d'euros toutes les 500ms
        this.interval = setInterval(() => {
            // Si le Green IT est activé, on consomme moins d'argent
            const step = this.isGreenItActive ? 15 : 85; 
            this.currentOpex += step;
            this.budgetEl.textContent = this.currentOpex.toLocaleString('fr-FR');
        }, 500);
    }

    initInteractions() {
        const btnCooling = document.getElementById('btn-cooling');
        const btnFirewall = document.getElementById('btn-firewall');
        const btnServers = document.getElementById('btn-servers');
        
        const infoPanel = document.getElementById('info-panel');
        const panelTitle = document.getElementById('panel-title');
        const panelContent = document.getElementById('panel-content');
        const closePanel = document.getElementById('close-panel');

        // Fermer le panneau
        closePanel.addEventListener('click', () => {
            infoPanel.classList.add('info-panel-hidden');
        });

        // Clic sur "1. COEUR RÉSEAU"
        btnFirewall.addEventListener('click', () => {
            panelTitle.textContent = "SAS SÉCURITÉ & RÉSEAU";
            panelContent.innerHTML = `
                <ul>
                    <li><strong>Sécurité Physique :</strong> Biométrie, sas anti-intrusion (mantrap).</li>
                    <li><strong>Classification :</strong> Tiers I à IV (Disponibilité de 99.995%).</li>
                    <li><strong>Meet-Me Room :</strong> Interconnexion des fibres optiques FAI.</li>
                    <li><strong>Anti-DDoS :</strong> Filtrage matériel de la requête à très haut débit.</li>
                </ul>
            `;
            infoPanel.classList.remove('info-panel-hidden');
        });

        // Clic sur "2. SALLE BLANCHE"
        btnServers.addEventListener('click', () => {
            panelTitle.textContent = "ARCHITECTURE SERVEURS";
            panelContent.innerHTML = `
                <ul>
                    <li><strong>Stockage :</strong> Baies 42U, Serveurs Lames, baies NVMe.</li>
                    <li><strong>Redondance :</strong> Données répliquées (RAID) pour éviter les pertes.</li>
                    <li><strong>Continuité (UPS) :</strong> Onduleurs électriques prenant le relais en 0ms en cas de coupure.</li>
                </ul>
            `;
            infoPanel.classList.remove('info-panel-hidden');
        });

        // Ton code existant pour le bouton Green IT (Cooling) reste ici
        btnCooling.addEventListener('click', () => {
            if (!this.isGreenItActive) {
                this.isGreenItActive = true;
                btnCooling.querySelector('.hotspot-label').textContent = "3. GREEN IT (ON)";
                btnCooling.style.background = "#00ccff";
                btnCooling.querySelector('.radar-ring').style.borderColor = "#00ccff";
                this.pueEl.textContent = "1.1 (Optimisé - Chaleur partagée)";
                this.pueEl.style.color = "#00ff66";
                
                // On peut aussi ouvrir le panneau pour expliquer le Green IT !
                panelTitle.textContent = "RÉCUPÉRATION DE CHALEUR";
                panelContent.innerHTML = `
                    <p>Activation du <strong>Watercooling</strong> sur processeur.</p>
                    <ul>
                        <li>Baisse immédiate des coûts OPEX (pas de clim).</li>
                        <li>L'eau chaude est redirigée vers le chauffage urbain (Serres, Bureaux).</li>
                        <li><strong>Bilan :</strong> Empreinte carbone réduite.</li>
                    </ul>
                `;
                infoPanel.classList.remove('info-panel-hidden');
            }
        });
    }
}