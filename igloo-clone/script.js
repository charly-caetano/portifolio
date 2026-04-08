/**
 * Lógica Three.js do Igloo.inc Clone
 * Foco Principal: Gerador do Iglu, Efeitos Atmosféricos e Crawler Camera baseada em Scroll
 */

// --- CONFIGURAÇÃO INICIAL E CENA ---
const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();

// O "coração" da atmosfera: Fog (Neblina) Exponecial recriando o tom de inverno
const fogColor = new THREE.Color('#080d12'); // Pouco mais escuro para contraste dramático
scene.fog = new THREE.FogExp2(fogColor, 0.022);
scene.background = fogColor;

// --- CÂMERA E RENDERIZADOR ---
const getAspect = () => window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(50, getAspect(), 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
// Sombras super precisas para realismo
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap; // VSM para sombras mais cinemáticas e borradas
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// --- CONFIGURAÇÃO DE LUZES (ILLUMINATION STUDIO) ---
// 1. Luz ambiente fraca pra dar visual aos blocos no escuro
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Reduzida para sombras mais fortes
scene.add(ambientLight);

// 2. Luz Externa Direcional Fria (Luar / Atmosphere Light)
const moonLight = new THREE.DirectionalLight(0xaabbff, 3.0); // Luar mais potente HDR
moonLight.position.set(20, 40, 10);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 2048; // Alta resolução (realismo do gelo)
moonLight.shadow.mapSize.height = 2048;
moonLight.shadow.camera.near = 0.5;
moonLight.shadow.camera.far = 100;
moonLight.shadow.camera.left = -30;
moonLight.shadow.camera.right = 30;
moonLight.shadow.camera.top = 30;
moonLight.shadow.camera.bottom = -30;
moonLight.shadow.bias = -0.0005;
scene.add(moonLight);

// 3. Ponto Focal: Fogo Místico / Energia interna que vaza
const internalCoreLight = new THREE.PointLight(0xffd5a6, 25, 40); // Uma luz interna bem alaranjada/quente
internalCoreLight.position.set(0, 3, 0); 
scene.add(internalCoreLight);

// --- CONSTRUTOR PROCEDURAL DO IGLU (MATEMÁTICA EM CÚPULA) ---
const iglooGroup = new THREE.Group();
const doorBlocks = []; // Vetor de armazenamento da porta para animação de abertura

// Formato padrão do tijolo de gelo
const blockGeom = new THREE.BoxGeometry(1.6, 1.0, 1.2); 
// Material super-realista físico de gelo/vidro fosco!
const blockMat = new THREE.MeshPhysicalMaterial({
    color: 0x90b5c9,       
    roughness: 0.15,       // Superfície lisa
    metalness: 0.1,
    clearcoat: 1.0,        // Brilho do gelo
    clearcoatRoughness: 0.15,
    transmission: 0.45,    // Translucidez do vidro/gelo
    ior: 1.4,              // Índice de Refração do gelo
    thickness: 1.0         // Simula a grossura interna do bloco na luz
});

const iglooRadius = 12;
const layers = 14;   // Iglu alto
const gap = 0.08;    // O segredo do design: frestas para vazar a 'internalCoreLight'

for (let currentLayer = 0; currentLayer <= layers; currentLayer++) {
    // Escalar altura baseada 0 a 90 graus (topo da semiesfera PI/2)
    const phi = (currentLayer / layers) * (Math.PI / 2); 
    
    const layerRadius = Math.max(0.1, iglooRadius * Math.cos(phi));
    const layerHeight = iglooRadius * Math.sin(phi);
    
    const circumference = 2 * Math.PI * layerRadius;
    const blocksInRing = Math.max(1, Math.floor(circumference / (1.6 + gap)));
    
    for (let currentBlock = 0; currentBlock < blocksInRing; currentBlock++) {
        // Rotação radial (volta completa do circulo 2*PI)
        const theta = (currentBlock / blocksInRing) * Math.PI * 2;
        
        const x = layerRadius * Math.cos(theta);
        const z = layerRadius * Math.sin(theta);
        
        const blockMesh = new THREE.Mesh(blockGeom, blockMat.clone()); // Clonar material para cada um pois opacidade muda
        blockMesh.position.set(x, layerHeight + 0.5, z);
        
        // Rotação: olhar para o núcleo vertical respectivo ao chão e tombar verticalmente
        blockMesh.lookAt(0, layerHeight + 0.5, 0); // Encara o interior do cilindro
        blockMesh.rotateX(phi); // Curvatura da Cúpula
        
        blockMesh.castShadow = true;
        blockMesh.receiveShadow = true;
        
        // ---- Abertura da "PORTA" do iglu (Blocos Cinemáticos Realistas) ----
        const angleFromCenter = Math.abs(theta - Math.PI/2);
        const isDoorZone = currentLayer < 5 && (angleFromCenter < 0.8 || angleFromCenter > 2*Math.PI - 0.8);
        
        if (isDoorZone) {
            // Em vez de fragmentar cacos irracionais, os blocos monolíticos perfeitos do gelo
            // são empurrados sofrendo torque físico. Alguns flutuam alto, outros nem tanto!
            
            const explodeDir = new THREE.Vector3().copy(blockMesh.position).normalize();
            
            // Cada bloco tem um peso/força de propulsão diferente
            const force = 3 + Math.random() * 8; 
            const targetPos = blockMesh.position.clone().add(explodeDir.multiplyScalar(force));
            
            // Y espalhado de forma parabólica (Vai mais longe e mais alto)
            targetPos.y += (Math.random() > 0.4 ? 1 : -0.5) * (2 + Math.random() * 6); 
            
            // Delay de explosão individual pra cada bloco de gelo 
            const randomDelayOffset = -0.15 + Math.random() * 0.3; 
            
            doorBlocks.push({
                mesh: blockMesh,
                originalPos: blockMesh.position.clone(),
                targetPos: targetPos,
                originalRot: blockMesh.rotation.clone(),
                axis: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize(),
                rspeed: 1.0 + Math.random() * 2,
                delayOffset: randomDelayOffset
            });
        }

        iglooGroup.add(blockMesh);
    }
}
scene.add(iglooGroup);

// --- TERRENO (Chão de inverno rochoso/árido) ---
const groundGeom = new THREE.PlaneGeometry(300, 300, 128, 128); // Subdivisões maiores pro chão não ficar 'pontudo' demais
const groundMat = new THREE.MeshStandardMaterial({
    color: 0x05080c,
    roughness: 0.95,
    metalness: 0.05
});
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.rotation.x = -Math.PI / 2;

// Deformação nos vértices pra criar ambiente orgânico 
const pos = ground.geometry.attributes.position;
for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, (Math.random() - 0.5) * 1.5); // Montes de neve sútil
}
ground.geometry.computeVertexNormals();
ground.receiveShadow = true;
scene.add(ground);

// --- MARCADORES INTERATIVOS (Flutuantes estilo Igloo.inc) ---
const markers = [];
const createMarker = (x, y, z) => {
    // Marcador branco super brilhante
    const geom = new THREE.SphereGeometry(0.3, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    
    // Parâmetros pra animação de flutuação
    mesh.userData = {
        startY: y,
        speed: 1.5 + Math.random(),
        offset: Math.random() * Math.PI * 2
    };
    scene.add(mesh);
    markers.push(mesh);
};

// Marcadores estrategicamente postos fora e dentro
createMarker(-4, 9, -6);
createMarker(6, 7, -3);
createMarker(0, 5, 2);

// --- OS PINGUINS (A Tribo Low Poly de Inverno) ---
const penguinsGroup = new THREE.Group();
const penguins = [];
scene.add(penguinsGroup);

// Geometrias e Materiais Organicos (Esferas Esticadas para imitar os contornos reais do animal)
const pSphereGeo = new THREE.SphereGeometry(1, 32, 24);
const pConeGeo = new THREE.ConeGeometry(1, 1, 16);

// Materiais Físicos de alta fidelidade
const pBlackMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.5, clearcoat: 0.3 });
const pWhiteMat = new THREE.MeshPhysicalMaterial({ color: 0xeeeeee, roughness: 0.4, clearcoat: 0.2 });
const pOrangeMat = new THREE.MeshPhysicalMaterial({ color: 0xff6600, roughness: 0.6 });
const pEyeMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.05, clearcoat: 1.0 });

const createPenguin = (angleOffset, radiusOffset) => {
    const pGroup = new THREE.Group();

    // Envoltório para facilitar o 'gingado' (Waddle)
    const penguinBody = new THREE.Group();
    penguinBody.position.y = 0.85; 
    pGroup.add(penguinBody);
    
    // Corpo Orgânico (Ovalado / Barriga pra baixo)
    const body = new THREE.Mesh(pSphereGeo, pBlackMat);
    body.scale.set(0.4, 0.75, 0.45);
    body.castShadow = true;
    penguinBody.add(body);
    
    // Barriga (Ovalada Branca no peito)
    const belly = new THREE.Mesh(pSphereGeo, pWhiteMat);
    belly.scale.set(0.36, 0.71, 0.4);
    belly.position.set(0, -0.05, 0.09);
    belly.castShadow = true;
    penguinBody.add(belly);
    
    // Cabeça
    const head = new THREE.Mesh(pSphereGeo, pBlackMat);
    head.scale.set(0.35, 0.30, 0.35);
    head.position.set(0, 0.8, 0.1);
    head.castShadow = true;
    penguinBody.add(head);
    
    // Bico (Cone achatado)
    const beak = new THREE.Mesh(pConeGeo, pOrangeMat);
    beak.scale.set(0.12, 0.35, 0.12);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.8, 0.55);
    beak.castShadow = true;
    penguinBody.add(beak);
    
    // Olho Esquerdo
    const eyeL = new THREE.Mesh(pSphereGeo, pWhiteMat);
    eyeL.scale.set(0.08, 0.08, 0.08);
    eyeL.position.set(-0.16, 0.88, 0.38);
    penguinBody.add(eyeL);
    
    // Pupila Esquerda
    const pupilL = new THREE.Mesh(pSphereGeo, pEyeMat);
    pupilL.scale.set(0.04, 0.04, 0.04);
    pupilL.position.set(-0.18, 0.88, 0.44);
    penguinBody.add(pupilL);
    
    // Olho Direito
    const eyeR = new THREE.Mesh(pSphereGeo, pWhiteMat);
    eyeR.scale.set(0.08, 0.08, 0.08);
    eyeR.position.set(0.16, 0.88, 0.38);
    penguinBody.add(eyeR);
    
    // Pupila Direita
    const pupilR = new THREE.Mesh(pSphereGeo, pEyeMat);
    pupilR.scale.set(0.04, 0.04, 0.04);
    pupilR.position.set(0.18, 0.88, 0.44);
    penguinBody.add(pupilR);
    
    // Nadadeira Esquerda
    const flipL = new THREE.Mesh(pSphereGeo, pBlackMat);
    flipL.scale.set(0.05, 0.45, 0.2);
    flipL.position.set(-0.4, 0.1, 0);
    flipL.rotation.z = -0.15; // Inclinada levemente pra fora
    flipL.castShadow = true;
    penguinBody.add(flipL);
    
    // Nadadeira Direita
    const flipR = new THREE.Mesh(pSphereGeo, pBlackMat);
    flipR.scale.set(0.05, 0.45, 0.2);
    flipR.position.set(0.4, 0.1, 0);
    flipR.rotation.z = 0.15; // Inclinada levemente pra fora
    flipR.castShadow = true;
    penguinBody.add(flipR);
    
    // Patinhas Laranjas Chatazinhas
    const footL = new THREE.Mesh(pSphereGeo, pOrangeMat);
    footL.scale.set(0.18, 0.06, 0.25);
    footL.position.set(-0.2, -0.75, 0.12);
    footL.castShadow = true;
    penguinBody.add(footL); 
    
    const footR = new THREE.Mesh(pSphereGeo, pOrangeMat);
    footR.scale.set(0.18, 0.06, 0.25);
    footR.position.set(0.2, -0.75, 0.12);
    footR.castShadow = true;
    penguinBody.add(footR); 
    
    // Configurações Locais de Caminhada
    pGroup.userData = {
        angle: angleOffset,
        radius: 17 + radiusOffset, 
        speed: 0.0012 + (Math.random() * 0.0008),     // Imperial e lento
        waddleSpeed: 3 + Math.random(),               // Rebolado ritmizado
        body: penguinBody,
        flipL: flipL,
        flipR: flipR
    };
    
    return pGroup;
};

// Bando caminhando colado na neve
for (let i = 0; i < 4; i++) {
    const p = createPenguin(-Math.PI/2 - (i * 0.2), Math.random() * 1.0); 
    penguins.push(p);
    penguinsGroup.add(p);
}


// --- MOTORE (Lógica Core) de SCROLL-DRIVING DA CÂMERA ---
/* 
    Ponto A: Distante e aberto na paisagem revelando a escala do iglu
    Ponto B: Câmera desce e viaja até aproximar do portal central da construção
*/
const startCamPos = new THREE.Vector3(-35, 12, 45);
const startTarget = new THREE.Vector3(0, 6, 0);

const endCamPos   = new THREE.Vector3(0, 3, 18);
const endTarget   = new THREE.Vector3(0, 4, 0);

camera.position.copy(startCamPos);
camera.lookAt(startTarget);

let targetScrollProgress = 0;
let currentScrollProgress = 0;

window.addEventListener('scroll', () => {
    // Máximo possível de descer garantindo que não seja 0
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    // Onde o utilizador está em float (0.0 até 1.0)
    targetScrollProgress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
});

// Interpolador Linear Suave
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

// Parallax Subtil para Responsividade do Mouse
let mouseX = 0;
let mouseY = 0;
window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// --- RENDER LOOP GIGANTE ---
const clock = new THREE.Clock();

const animate = () => {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // 1. Ease progressivo (A câmera nunca para dura, ela "alcança" o target)
    currentScrollProgress = lerp(currentScrollProgress, targetScrollProgress, 0.06);

    // 2. Aplicar posição da Câmera por interpolação em arco
    // arcBend garante que a câmera dê um leve CÍRCULO durante a descida pra dar profundidade
    const arcBend = Math.sin(currentScrollProgress * Math.PI) * 15; 
    
    camera.position.x = lerp(startCamPos.x, endCamPos.x, currentScrollProgress) + arcBend; 
    camera.position.y = lerp(startCamPos.y, endCamPos.y, currentScrollProgress);
    camera.position.z = lerp(startCamPos.z, endCamPos.z, currentScrollProgress);
    
    // 3. Aplicar Focus Target da Câmera
    const curTx = lerp(startTarget.x, endTarget.x, currentScrollProgress);
    const curTy = lerp(startTarget.y, endTarget.y, currentScrollProgress);
    const curTz = lerp(startTarget.z, endTarget.z, currentScrollProgress);
    camera.lookAt(curTx, curTy, curTz);

    // 4. Parallax Final
    // Só deixamos o mouse deslizar muito caso estejamos de longe (início) - 
    // perto do iglu (fim do scroll), queremos travar mais a visão (1 - currentScrollProgress).
    camera.position.x += mouseX * 0.8 * (1 - currentScrollProgress);
    camera.position.y += mouseY * 0.8 * (1 - currentScrollProgress);

    // 5. Animando os marcadores flutuantes
    markers.forEach(m => {
        m.position.y = m.userData.startY + Math.sin(time * m.userData.speed + m.userData.offset) * 0.6;
    });

    // 6. Cintilar a luz interna dando sensação de reator/vida no iglu
    internalCoreLight.intensity = 10 + Math.sin(time * 3) * 2 + Math.cos(time * 5.2) * 1;

    // 7. Mostrar/Esconder o Painel de Vidro do Portfólio 
    const panel = document.getElementById('portfolio-panel');
    const instructionText = document.querySelector('.instruction');
    if (panel && currentScrollProgress > 0.85) {
        panel.classList.add('visible');
        if (instructionText) instructionText.style.opacity = '0';
    } else if (panel) {
        panel.classList.remove('visible');
        if (instructionText) instructionText.style.opacity = '';
    }

    // 8. O Ginga-ginga (Waddle) de Pinguins Realistas
    penguins.forEach(p => {
        const u = p.userData;
        u.angle -= u.speed; // Caminham sentido anti-horário em volta
        
        // Circular Path
        p.position.x = Math.cos(u.angle) * u.radius;
        p.position.z = Math.sin(u.angle) * u.radius;
        
        // Olhar pra frente na direção correta do movimento(Tangente da curva)
        // Corrigido para +sin e -cos pois o ângulo está decescendo (-= speed)
        p.lookAt(p.position.x + Math.sin(u.angle), p.position.y, p.position.z - Math.cos(u.angle));
        
        // O efeito Walking Orgânico
        const waddleValue = Math.sin(time * u.waddleSpeed);
        
        // Rebola macio (Balançando o corpo pros lados ao andar)
        u.body.rotation.z = waddleValue * 0.12; 
        
        // Bate as asas (Flippers) pra trás e pra frente pra dar balanço
        u.flipL.rotation.x = waddleValue * 0.25;
        u.flipR.rotation.x = -waddleValue * 0.25;
        
        // Pulo do caminhar sutil (Ping de altura)
        p.position.y = Math.abs(waddleValue) * 0.08;
    });

    // 9. Animação Física e Realista de Blocos Flutuantes
    const rawOpenAmt = Math.max(0, Math.min(1, (currentScrollProgress - 0.6) * 3)); 
    
    doorBlocks.forEach((d) => {
        // Aplica delay individual por bloco pra não explodirem igual um gif programado
        let localOpenAmt = Math.max(0, Math.min(1, rawOpenAmt + (rawOpenAmt > 0 ? d.delayOffset : 0)));
        
        // Easing Quintico (Começa devagarzinho, ganha peso, e sofre inércia no voo final)
        const easedAmt = localOpenAmt === 0 ? 0 : 1 - Math.pow(1 - localOpenAmt, 3);
        
        d.mesh.position.lerpVectors(d.originalPos, d.targetPos, easedAmt);
        
        if (localOpenAmt > 0) {
            // Torque acumulativo: quanto mais longe viajam, mais giram com decaimento natural
            const rotFactor = time * d.rspeed * easedAmt * 0.4;
            d.mesh.rotation.x = d.originalRot.x + d.axis.x * rotFactor;
            d.mesh.rotation.y = d.originalRot.y + d.axis.y * rotFactor;
            d.mesh.rotation.z = d.originalRot.z + d.axis.z * rotFactor;
            
            // Fica transparente para visualizarmos a interface
            d.mesh.material.transparent = true;
            d.mesh.material.opacity = 1 - (easedAmt * 0.85);
        } else {
            // Sela perfeitamente o Igloo sem falhas de ângulo!
            d.mesh.rotation.copy(d.originalRot);
            d.mesh.material.opacity = 1.0;
        }
    });

    renderer.render(scene, camera);
};

animate();

// --- GERENCIAMENTO DE GUI (MODAL INTERATIVO) ---
const modalData = {
    "java": `
        <p><strong>Java Backend Avançado:</strong> Minha especialidade central.</p>
        <p>Experiência profunda na construção de aplicações corporativas escaláveis, utilizando todo o ecossistema moderno do Java.</p>
        <ul>
            <li><strong>Desempenho:</strong> Otimização de concorrência e gerenciamento de threads.</li>
            <li><strong>Testes:</strong> JUnit, Mockito e TDD garantindo resiliência.</li>
            <li><strong>Design:</strong> Aplicação rigorosa de SOLID e Design Patterns.</li>
        </ul>
    `,
    "javascript": `
        <p><strong>JavaScript & ES6+:</strong> O motor da web dinâmica.</p>
        <p>Uso avançado de escopos, closures, programação assíncrona (Promises/Async-Await) e manipulação eficiente do DOM.</p>
        <ul>
            <li><strong>Ecossistema:</strong> Domínio absoluto de Vanilla JS para máxima performance, além de fluência em frameworks modernos.</li>
            <li><strong>Integração:</strong> Consumo ágil de APIs RESTful e WebSockets de tempo real.</li>
        </ul>
    `,
    "spring": `
        <p><strong>Spring Boot & Framework:</strong> Escalabilidade corporativa.</p>
        <p>Construção de microsserviços robustos, injeção de dependências eficiente e configuração simplificada.</p>
        <ul>
            <li><strong>Segurança:</strong> Spring Security blindando acessos com JWT e OAuth2.</li>
            <li><strong>Dados:</strong> Domínio de Spring Data JPA e integrações complexas de banco de dados SQL/NoSQL.</li>
        </ul>
    `,
    "frontend": `
        <p><strong>HTML5 & CSS3:</strong> A fundação do design invisível.</p>
        <p>Semântica perfeita para acessibilidade estrutural e SEO técnico, aliada a layouts fluidos e responsivos utilizando Flexbox e CSS Grid.</p>
        <ul>
            <li><strong>Estilização:</strong> Animações CSS core-avançadas, transições 3D em canvas e Glassmorphism UI.</li>
            <li><strong>Arquitetura CSS:</strong> BEM e SASS para manutenibilidade unificada em repós em grande escala.</li>
        </ul>
    `,
    "devops": `
        <p><strong>Git & Práticas DevOps:</strong> Entregas contínuas e seguras.</p>
        <p>Versionamento semântico estrito e familiaridade robusta com fluxos de Pipeline (CI/CD) para automatizar testes e deploys de código à nuvem.</p>
        <ul>
            <li><strong>Habilidades:</strong> Git Flow, Merge conflicts handling analítico e Code Reviews.</li>
            <li><strong>Containerização:</strong> Conhecimentos profundos de Docker para padronização atômica de ambientes de desenvolvimento.</li>
        </ul>
    `,
    "problem-solving": `
        <p>Capacidade de fragmentar arquiteturas sistêmicas de alta complexidade em problemas independentes e codificáveis. O foco é entregar soluções algorítmicas de alto desempenho produtivo ao invés de atalhos insustentáveis (gerando ganhos sistêmicos de O(1) e O(log n)).</p>
    `,
    "critical-thinking": `
        <p>Análise preventiva de Edge Cases e Testes Limites antes da escrita definitiva do código em repouso. É a capacidade de antecipar dezenas de gargalos arquiteturais e sugerir refatorações elegantes usando Design Patterns precisamente escolhidos de acordo com a regra de negócio real.</p>
    `,
    "team-work": `
        <p>Trabalho estruturado ativamente sob escopo de metodologias ágeis (Scrum/Kanban de entrega contínua). Extremamente experiente em Code Reviews construtivos entre devs e padronização visual (Clean Code) com o intuito macro de democratizar o repositório entre os membros juniores com empatia intelectual.</p>
    `,
    "communication": `
        <p>Tradução técnica verbal fluente entre os setores de negócio (Stakeholders/Clients) e a ilha de engenharia (Tech). Excelente capacidade de documentar decisões arquiteturais vitais (ADRs) de forma limpa, estritamente técnica e de acesso rápido direto à dúvida.</p>
    `,
    "proj-arch": `
        <p><strong>Arquitetura de Softwares Empresariais Massivos</strong></p>
        <p>Neste modelo analítico de projeto, desenvolvi uma API REST completa utilizando Java Spring Boot. Resolvi problemas severos de concorrência com travas de tabela lógicas no ecossistema de banco de dados.</p>
        <ul>
            <li><strong>Desafio Transacional:</strong> Garantir operações distribuídas seguras sem gargalos lentíssimos na leitura base da aplicação.</li>
            <li><strong>Plano Executado:</strong> Implementação de mensageria assíncrona com microsserviços de baixo peso desassociados para balancear a carga de logs.</li>
        </ul>
    `,
    "proj-webgl": `
        <p><strong>Portfólio 3D Cinemático Anti-Gravity (Sistema Atual Localhost)</strong></p>
        <p>Engenharia de display imersivo ultra moderno evidenciando grande domínio lógico e matemático de WebGL (via framework Three.js) renderizando gráficos hiper-realistas diretamente no front-end browser, sem dependências externas ou downloads de pacotes do usuário.</p>
        <ul>
            <li><strong>Aspectos Matemáticos:</strong> Geração procedural orgânica de geometria fractal (A cúpula polar); Motores de interpolação não lineares baseados em cálculos Inerciais Easing atrelados nativamente à API de scroll da página.</li>
            <li><strong>Ajuste de Desempenho:</strong> O complexo modelo computacional suporta constante fluida mantendo rígidos 60 FPS garantindo Renderização de Máscaras e sombras interativas brandas de alta escala sem sobreaquecer o chip GPU do visitante.</li>
        </ul>
    `
};

const modalOverlay = document.getElementById('details-modal');
const modalTitle = document.getElementById('modal-content-title');
const modalBody = document.getElementById('modal-content-body');
const closeBtn = document.getElementById('close-modal-btn');
const clickableItems = document.querySelectorAll('.clickable-item');

function openModal(id, title) {
    if(!modalData[id]) return;
    
    // Injeta os dados dinamicamente manipulando o DOM da Janela Limpa
    modalTitle.innerText = title;
    modalBody.innerHTML = modalData[id];
    
    // Abre acionando gatilho de transição no CSS
    modalOverlay.classList.remove('hidden');
    // Forçamos micro-delay atômico pro navegador processar o display block de visualização 
    // antes de engatilhar a transição de opacidade da classe interpoladora
    setTimeout(() => {
        modalOverlay.classList.add('active');
    }, 10);
}

function closeModal() {
    modalOverlay.classList.remove('active');
    // Espera terminar estritamente a janela de fade-out do CSS nativo da placa de vídeo e então cessa do DOM
    setTimeout(() => {
        modalOverlay.classList.add('hidden');
    }, 400); // .4s garante fechar sem piscar seco
}

// Vincula o clique de escuta em todos os painéis e blocos do portfolio-box
clickableItems.forEach(item => {
    item.addEventListener('click', () => {
        const id = item.getAttribute('data-modal-id');
        let title = "Detalhes";
        
        // IA Lógica que pega excelentemente o título derivado de como a árvore HTML é disposta ali dentro!
        if (item.querySelector('span')) title = item.querySelector('span').innerText;
        else if (item.tagName === 'SPAN') title = item.innerText;
        else if (item.querySelector('h4')) title = item.querySelector('h4').innerText;
        
        openModal(id, title);
    });
});

closeBtn.addEventListener('click', closeModal);

// Clique intencional na área background morta engatilha o fim do Pop up (Padrão corporativo limpo UI moderno)
modalOverlay.addEventListener('click', (e) => {
    // Se target real é inteiramente só o fundo do vidro overlay embaçado (sem ser caixa)
    if (e.target === modalOverlay) closeModal();
});

// --- EVENTOS DE TELA E REDIMENSIONAMENTO ---
window.addEventListener('resize', () => {
    camera.aspect = getAspect();
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
