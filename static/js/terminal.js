// Logique des commandes réseau et synchronisation vidéo
export class CyberTerminal {
    constructor(onCommandValid) {
        this.input = document.getElementById('terminal-input');
        this.output = document.getElementById('terminal-output');
        this.onCommandValid = onCommandValid; // Fonction appelée quand une commande réussit
        
        // La liste de tes commandes scénarisées dans l'ordre de la présentation
        this.commands = [
            "connect --target=dc-core",
            "reroute --backup-ups",
            "enable --heat-recovery --watercooling"
        ];
        this.currentCmdIndex = 0;

        this.initEvents();
    }

    initEvents() {
        this.input.addEventListener('keydown', (e) => {
            // AUTO-COMPLÉTION AVEC TAB (Anti-stress pour l'oral)
            if (e.key === 'Tab') {
                e.preventDefault(); 
                if (this.currentCmdIndex < this.commands.length) {
                    this.input.value = this.commands[this.currentCmdIndex];
                }
            } 
            // VALIDATION DE LA COMMANDE
            else if (e.key === 'Enter') {
                const cmd = this.input.value.trim();
                if (cmd) {
                    this.print(`> root@iut-rt:~$ ${cmd}`, '#00ff66');
                    this.input.value = '';
                    this.processCommand(cmd);
                }
            }
        });
    }

    // Affiche du texte dans la console HTML
    print(text, color = '#aaffaa') {
        const div = document.createElement('div');
        div.style.color = color;
        div.textContent = text;
        this.output.appendChild(div);
        this.output.scrollTop = this.output.scrollHeight;
    }

    // Traitement logique des commandes
    processCommand(cmd) {
        if (cmd === this.commands[0]) {
            this.currentCmdIndex++;
            this.simulateLogs([
                "[AUTH] Vérification des clés RSA...",
                "[OK] Accès autorisé au segment sécurisé.",
                "[TCP] Encapsulation de la requête...",
                "[BGP] Calcul de la route optique la plus courte...",
                ">>> DÉPLOIEMENT DU PAQUET EN COURS <<<"
            ], () => {
                this.onCommandValid('launch_fiber'); // Dit à app.js de lancer la vidéo
            });
        } 
        else if (cmd === "clear") {
            this.output.innerHTML = '';
        }
        else {
            this.print(`Commande non reconnue ou accès refusé : ${cmd}`, '#ff3333');
        }
    }

    // Fait défiler de faux logs avec un délai de 400ms pour l'effet cinéma
    simulateLogs(logs, callback) {
        let i = 0;
        const interval = setInterval(() => {
            this.print(logs[i], '#00ccff');
            i++;
            if (i >= logs.length) {
                clearInterval(interval);
                setTimeout(callback, 800); // Pause avant de lancer la vidéo
            }
        }, 400);
    }
}