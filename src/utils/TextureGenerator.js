import * as THREE from 'three';

export class TextureGenerator {
  /**
   * Helper to convert a canvas into a Three.js texture with retro pixel filtering.
   */
  static _canvasToTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  /**
   * Generates a premium interlocking hardwood oak plank floor texture.
   */
  static generateHardwoodFloor(_borderColor = '#7d4c37', _tileColor = '#4e2d1a', size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Oak hardwood floor base colors
    const oakBase = '#7d4c37';
    const numRows = 8;
    const rowH = size / numRows;

    // Dark seam line base
    ctx.fillStyle = '#301c12';
    ctx.fillRect(0, 0, size, size);

    // Draw interlocking boards
    for (let r = 0; r < numRows; r++) {
      const y = r * rowH;
      const numPlanks = 3;
      const plankW = size / numPlanks;
      const isOffset = r % 2 === 1;
      const startX = isOffset ? -plankW / 2 : 0;

      for (let p = 0; p <= numPlanks; p++) {
        const x = startX + p * plankW;

        // Randomize wood shade slightly for board variations
        const rand = Math.sin(r * 12.3 + x * 45.7) * 0.12;
        const plankColor = this._adjustBrightness(oakBase, rand);

        // Draw the main board wood block
        ctx.fillStyle = plankColor;
        ctx.fillRect(x + 1, y + 1, plankW - 2, rowH - 2);

        // Subtly lighter top edge bezel for three-dimensional wood edge depth
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(x + 1, y + 1, plankW - 2, 1);

        // Draw horizontal wood grain lines inside each plank
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.lineWidth = 1;

        const seedValue = Math.abs(Math.sin(r * 4.9 + p * 8.1));
        const numGrains = 2 + Math.floor(seedValue * 3);

        for (let g = 0; g < numGrains; g++) {
          const gy = y + 2 + ((seedValue * 31 + g * 17) % (rowH - 6));
          const gx1 = x + 3 + ((seedValue * 57 + g * 23) % (plankW - 16));
          const gl = 8 + ((seedValue * 97 + g * 11) % (plankW * 0.45));

          if (gx1 + gl < x + plankW - 2) {
            ctx.beginPath();
            ctx.moveTo(gx1, gy);
            ctx.lineTo(gx1 + gl, gy);
            ctx.stroke();
          }
        }

        // Draw a knot or randomized wood blemish occasionally
        if (seedValue > 0.75) {
          ctx.fillStyle = 'rgba(40, 20, 10, 0.35)';
          const kx = x + 6 + ((seedValue * 123) % (plankW - 12));
          const ky = y + 3 + ((seedValue * 456) % (rowH - 6));
          ctx.fillRect(Math.floor(kx), Math.floor(ky), 3, 2);
        }
      }
    }

    return this._canvasToTexture(canvas);
  }

  /**
   * Generates a cozy brick wall texture using rich terracotta clays or slate stones.
   */
  static generateBrickWall(baseColorHex = '#1e1a3a', mortarColorHex = '#080512', size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Map legacy material inputs to warm natural colors
    let base = baseColorHex;
    let mortar = mortarColorHex;

    if (base === '#221c38') {
      // Main walls -> Rich Terracotta Brick
      base = '#a25a42';
      mortar = '#4a251e';
    } else if (base === '#12121c') {
      // Boundary/Concrete walls -> Slate ash-grey brick
      base = '#4c4c4c';
      mortar = '#242424';
    } else if (base === '#17122b') {
      // Lounge Floor -> Beautiful forest green woven carpet
      base = '#1b4d22';
      mortar = '#091f0e';
    }

    const numRows = 8;
    const numCols = 4;
    const rowH = size / numRows;
    const colW = size / numCols;

    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, size, size);

    // Draw bricks with randomized organic shades
    for (let r = 0; r < numRows; r++) {
      const isOffset = r % 2 === 1;
      const startX = isOffset ? -colW / 2 : 0;

      for (let c = 0; c <= numCols; c++) {
        const x = startX + c * colW;
        const y = r * rowH;

        // Structured randomized brightness using trig coordinates to lock across re-renders
        const rand = Math.sin(r * 34.5 + c * 89.1) * 0.15;
        ctx.fillStyle = this._adjustBrightness(base, rand);
        ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 2);

        // Brick highlight (pixel art bezel)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(x + 2, y + 2, colW - 4, 1);
        ctx.fillRect(x + 2, y + 2, 1, rowH - 2);

        // Brick shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(x + colW - 3, y + 2, 1, rowH - 2);
        ctx.fillRect(x + 2, y + rowH - 1, colW - 4, 1);
      }
    }

    return this._canvasToTexture(canvas);
  }

  /**
   * Generates a vintage wood-panel turntable and analog mixer console.
   */
  static generateTurntableConsole(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Solid mahogany wood cabinet backing board
    ctx.fillStyle = '#4e2518';
    ctx.fillRect(0, 0, size, size);

    // Dark panel borders (inset look)
    ctx.strokeStyle = '#2d150d';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, size - 8, size - 8);

    // Elegant brass faceplates
    ctx.fillStyle = '#bfa15f'; // rich brass
    ctx.fillRect(12, 12, size * 0.42, size - 24);
    ctx.fillRect(size * 0.54, 12, size * 0.42, size - 24);

    ctx.strokeStyle = '#785f2f'; // brass outline bevel
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, size * 0.42, size - 24);
    ctx.strokeRect(size * 0.54, 12, size * 0.42, size - 24);

    // Draw record platters on the brass plates
    const platters = [
      { cx: size * 0.33, cy: size * 0.5 },
      { cx: size * 0.75, cy: size * 0.5 },
    ];

    platters.forEach((p) => {
      // Cast shadow under platter
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.arc(p.cx + 2, p.cy + 3, size * 0.16, 0, Math.PI * 2);
      ctx.fill();

      // Platter outer black rubber ring
      ctx.fillStyle = '#222222';
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, size * 0.16, 0, Math.PI * 2);
      ctx.fill();

      // Vinyl record deep-black
      ctx.fillStyle = '#0f0f11';
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, size * 0.14, 0, Math.PI * 2);
      ctx.fill();

      // Grooves on record
      ctx.strokeStyle = '#1d1d21';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, size * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, size * 0.06, 0, Math.PI * 2);
      ctx.stroke();

      // Center gold labels (cozy warm design)
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, size * 0.035, 0, Math.PI * 2);
      ctx.fill();

      // Center silver peg
      ctx.fillStyle = '#dddddd';
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, size * 0.015, 0, Math.PI * 2);
      ctx.fill();

      // Classic brown wood/metal tone-arm needle
      ctx.strokeStyle = '#4e4028';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.cx + size * 0.12, p.cy - size * 0.12);
      ctx.lineTo(p.cx + size * 0.12, p.cy - size * 0.04);
      ctx.lineTo(p.cx + size * 0.06, p.cy + size * 0.04);
      ctx.stroke();
    });

    // Central Mixer partition
    ctx.fillStyle = '#2d150d';
    ctx.fillRect(size * 0.44, 12, size * 0.08, size - 24);

    // Warm-backlit Analog VU Meters
    // Meter bezels
    ctx.fillStyle = '#221910';
    ctx.fillRect(size * 0.44 + 2, 24, size * 0.08 - 4, 16);
    ctx.fillRect(size * 0.44 + 2, 48, size * 0.08 - 4, 16);

    // Warm glowing paper/gold dials
    ctx.fillStyle = '#ffdf80';
    ctx.fillRect(size * 0.44 + 4, 26, size * 0.08 - 8, 12);
    ctx.fillRect(size * 0.44 + 4, 50, size * 0.08 - 8, 12);

    // Thin black needle pointers
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size * 0.48, 38);
    ctx.lineTo(size * 0.48 + 5, 28);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.48, 62);
    ctx.lineTo(size * 0.48 - 4, 52);
    ctx.stroke();

    // Solid metal slide adjustments
    ctx.fillStyle = '#100a06';
    ctx.fillRect(size * 0.46, 80, 4, 48);
    ctx.fillRect(size * 0.5, 80, 4, 48);

    // Brass knobs
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(size * 0.47, 140, 6, 6);
    ctx.fillRect(size * 0.47, 160, 6, 6);

    return this._canvasToTexture(canvas);
  }

  /**
   * Generates a vintage walnut monitor speaker with a cloth weave grille face.
   */
  static generateSpeakerCone(size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Rich Walnut outer frame
    ctx.fillStyle = '#5c3d24';
    ctx.fillRect(0, 0, size, size);

    // Bevel shadow
    ctx.fillStyle = '#3a2717';
    ctx.fillRect(8, 8, size - 16, size - 16);

    // Woven thread fabric backing (Grille cloth)
    const grilleBase = '#2b2520';
    ctx.fillStyle = grilleBase;
    ctx.fillRect(10, 10, size - 20, size - 20);

    // Draw vertical and horizontal fabric threads
    ctx.strokeStyle = '#3d342d';
    ctx.lineWidth = 1;
    for (let i = 12; i < size - 10; i += 4) {
      // Horizontal threads
      ctx.beginPath();
      ctx.moveTo(10, i);
      ctx.lineTo(size - 10, i);
      ctx.stroke();

      // Vertical threads
      ctx.beginPath();
      ctx.moveTo(i, 10);
      ctx.lineTo(i, size - 10);
      ctx.stroke();
    }

    // Centered woofer paper cone
    const cx = size / 2;
    const cy = size / 2;

    // Dark shadow on the fabric grille
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Outer brass mounting bezel
    ctx.fillStyle = '#8a6c55';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Main charcoal paper pulp cone
    ctx.fillStyle = '#1c1b18';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Concentric paper cone rings
    ctx.strokeStyle = '#2d2b27';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.16, 0, Math.PI * 2);
    ctx.stroke();

    // Center warm metal dust cap
    ctx.fillStyle = '#0f0e0c';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Gold highlight line on the dust cap
    ctx.fillStyle = 'rgba(212, 175, 55, 0.15)';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, size * 0.08, Math.PI, Math.PI * 1.5);
    ctx.stroke();

    return this._canvasToTexture(canvas);
  }

  /**
   * Generates detailed natural pixel-art faces for cozy visitors.
   */
  static generateNPCFace(
    skinColor = '#f5c396',
    eyeColor = '#111122',
    glassesColor = null,
    size = 64
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Fill face skin tone
    ctx.fillStyle = skinColor;
    ctx.fillRect(0, 0, size, size);

    // Bottom block neck shade
    ctx.fillStyle = this._adjustBrightness(skinColor, -0.15);
    ctx.fillRect(0, size - 8, size, 8);

    const eyeY = 24;
    const leftEyeX = 12;
    const rightEyeX = 36;
    const eyeW = 8;
    const eyeH = 12;

    if (glassesColor) {
      // Draw classic gold round wire spectacles (replaces blocky glowing visors)
      ctx.strokeStyle = '#d4af37'; // gold rims
      ctx.lineWidth = 2;

      // Draw left spectacles frame
      ctx.beginPath();
      ctx.arc(16, eyeY + 6, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Draw right spectacles frame
      ctx.beginPath();
      ctx.arc(48, eyeY + 6, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Bridge wire
      ctx.beginPath();
      ctx.moveTo(25, eyeY + 6);
      ctx.lineTo(39, eyeY + 6);
      ctx.stroke();

      // Spectacle lens shine pixels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(14, eyeY + 1, 4, 3);
      ctx.fillRect(46, eyeY + 1, 4, 3);

      // Simple black dots inside frames
      ctx.fillStyle = eyeColor;
      ctx.fillRect(leftEyeX + 2, eyeY + 4, 4, 6);
      ctx.fillRect(rightEyeX + 2, eyeY + 4, 4, 6);
    } else {
      // Warm expressive eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(leftEyeX, eyeY, eyeW, eyeH);
      ctx.fillRect(rightEyeX, eyeY, eyeW, eyeH);

      ctx.fillStyle = eyeColor;
      ctx.fillRect(leftEyeX + 2, eyeY + 4, 4, 6);
      ctx.fillRect(rightEyeX + 2, eyeY + 4, 4, 6);

      // Rhythmic content smile
      ctx.fillStyle = '#cc5a5a';
      ctx.fillRect(24, 44, 16, 4);
    }

    // Natural hair bounds (blonde, brunette, ginger, dark hair)
    const hairSeed = Math.abs(Math.sin(skinColor.length * 100));
    let hairColor = '#2c1e15'; // dark brunette
    if (hairSeed > 0.75)
      hairColor = '#d29a53'; // warm gold blonde
    else if (hairSeed > 0.5)
      hairColor = '#b55a30'; // ginger auburn
    else if (hairSeed > 0.25) hairColor = '#50413c'; // light brown

    ctx.fillStyle = hairColor;
    ctx.fillRect(0, 0, size, 12); // top hair band
    ctx.fillRect(0, 12, 8, size - 24); // sideburns left
    ctx.fillRect(size - 8, 12, 8, size - 24); // sideburns right

    return this._canvasToTexture(canvas);
  }

  /**
   * Generates warm, cozy woolen clothing styles: plaid flannels, argyle diamonds, and heavy cable knits.
   */
  static generateNPCOutfit(
    mainColor = '#ff0055',
    secondaryColor = '#00f0ff',
    type = 'jacket',
    size = 64
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Set fallback backing color
    ctx.fillStyle = mainColor;
    ctx.fillRect(0, 0, size, size);

    if (type === 'jacket') {
      // Warm cable knit cardigan sweater
      // Draw vertical cabling ribs
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let i = 4; i < size; i += 12) {
        ctx.fillRect(i, 0, 3, size);
      }

      // Rounded collar band
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(0, 0, size, 8);

      // Button placket in the center
      ctx.fillStyle = this._adjustBrightness(mainColor, -0.15);
      ctx.fillRect(size / 2 - 4, 8, 8, size - 8);

      // Wood-grained brown buttons
      ctx.fillStyle = '#5c3a21';
      for (let y = 14; y < size - 8; y += 14) {
        ctx.fillRect(size / 2 - 2, y, 4, 4);
      }
    } else if (type === 'stripes') {
      // Cozy lumberjack plaid flannel print
      ctx.fillStyle = secondaryColor;
      const stripeW = 8;
      for (let i = 4; i < size; i += 16) {
        ctx.fillRect(i, 0, stripeW, size); // vertical bands
        ctx.fillRect(0, i, size, stripeW); // horizontal bands
      }

      // Dark shadow overlay for intersections
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      for (let y = 4; y < size; y += 16) {
        for (let x = 4; x < size; x += 16) {
          ctx.fillRect(x, y, stripeW, stripeW);
        }
      }
    } else if (type === 'checker') {
      // Elegant argyle diamond sweater pattern (replaces tech squares)
      ctx.fillStyle = secondaryColor;
      const step = 16;
      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const isEvenRow = (y / step) % 2 === 0;
          const isEvenCol = (x / step) % 2 === 0;
          if (isEvenRow === isEvenCol) {
            ctx.beginPath();
            ctx.moveTo(x + step / 2, y);
            ctx.lineTo(x + step, y + step / 2);
            ctx.lineTo(x + step / 2, y + step);
            ctx.lineTo(x, y + step / 2);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // Elegant gold accent diagonal stitch lines
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(size, size);
      ctx.moveTo(size, 0);
      ctx.lineTo(0, size);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (type === 'pants') {
      // Chocolate brown corduroy or charcoal grey trousers
      ctx.fillStyle = '#42352f'; // chocolate base
      ctx.fillRect(0, 0, size, size);

      // Ribbed velvet texture
      ctx.fillStyle = '#302622';
      for (let i = 2; i < size; i += 4) {
        ctx.fillRect(i, 0, 2, size);
      }

      // Brown leather waist belt
      ctx.fillStyle = '#261b15';
      ctx.fillRect(0, 0, size, 6);
      ctx.fillStyle = '#c5a059'; // brass buckle
      ctx.fillRect(size / 2 - 5, 0, 10, 6);
    }

    return this._canvasToTexture(canvas);
  }

  /**
   * Generates beautiful hand-drawn botanical or serene landscape framed art prints.
   */
  static generatePoster(text = 'BOTANICAL', size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 1. Oak wood outer frame bezel
    ctx.fillStyle = '#4e311c';
    ctx.fillRect(0, 0, size, size);

    // Wood frame inner shading
    ctx.fillStyle = '#2d1c0e';
    ctx.fillRect(6, 6, size - 12, size - 12);

    // 2. Off-white linen mounting paper (passe-partout matte)
    ctx.fillStyle = '#f3ebe0';
    ctx.fillRect(10, 10, size - 20, size - 20);

    // Inner paper sketching frame line
    ctx.strokeStyle = '#dbd2c4';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, size - 32, size - 32);

    // 3. Draw a botanical leaf branch, spruce tree, or mountain sun rising
    ctx.fillStyle = '#1b4d22'; // rich forest green ink
    const cx = size / 2;
    const cy = size / 2;

    if (text === 'LOUNGE' || text === 'BOTANICAL') {
      // Paint an elegant leafy fern branch
      ctx.strokeStyle = '#1b4d22';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + 24);
      ctx.quadraticCurveTo(cx - 5, cy + 2, cx + 15, cy - 24);
      ctx.stroke();

      // Soft leaves
      ctx.fillStyle = '#256230';
      const leaflets = [
        { lx: cx - 12, ly: cy + 18, rx: cx - 22, ry: cy + 11 },
        { lx: cx - 8, ly: cy + 7, rx: cx - 18, ry: cy + 1 },
        { lx: cx - 2, ly: cy - 3, rx: cx - 12, ry: cy - 9 },
        { lx: cx + 4, ly: cy - 13, rx: cx - 4, ry: cy - 19 },
        { lx: cx + 12, ly: cy - 21, rx: cx + 5, ry: cy - 25 },
      ];

      leaflets.forEach((l) => {
        ctx.beginPath();
        ctx.ellipse(l.lx, l.ly, 6, 3, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(l.rx, l.ry, 6, 3, Math.PI / 6, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (text === 'VIP' || text === 'EVERGREEN') {
      // Paint a serene spruce alpine fir pine tree
      ctx.beginPath();
      ctx.moveTo(cx, cy + 30);
      ctx.lineTo(cx, cy - 30);
      ctx.strokeStyle = '#3d2516';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Foliage layers
      ctx.fillStyle = '#1b4d22';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 28);
      ctx.lineTo(cx - 10, cy - 14);
      ctx.lineTo(cx + 10, cy - 14);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#16401c';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 17);
      ctx.lineTo(cx - 16, cy + 3);
      ctx.lineTo(cx + 16, cy + 3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0f2b14';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 1);
      ctx.lineTo(cx - 22, cy + 22);
      ctx.lineTo(cx + 22, cy + 22);
      ctx.closePath();
      ctx.fill();
    } else {
      // Paint a warm minimalist rising sun sunset landscape
      // Rising warm sun
      ctx.fillStyle = '#e8a33e';
      ctx.beginPath();
      ctx.arc(cx, cy - 12, 14, 0, Math.PI * 2);
      ctx.fill();

      // Cozy copper-clay hills
      ctx.fillStyle = '#8f4f37';
      ctx.beginPath();
      ctx.arc(cx - 16, cy + 26, 24, 0, Math.PI, true);
      ctx.fill();

      ctx.fillStyle = '#6e3825';
      ctx.beginPath();
      ctx.arc(cx + 22, cy + 28, 20, 0, Math.PI, true);
      ctx.fill();
    }

    // Hand-signed tiny label print at bottom margin
    ctx.font = 'italic 7px Georgia, serif';
    ctx.fillStyle = '#7a6f62';
    ctx.textAlign = 'center';
    ctx.fillText('Botanica Editio I', size / 2, size - 14);

    return this._canvasToTexture(canvas);
  }

  /**
   * Helper to adjust color hex brightness programmatically.
   */
  static _adjustBrightness(hex, percent) {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = parseInt(R * (1 + percent));
    G = parseInt(G * (1 + percent));
    B = parseInt(B * (1 + percent));

    R = Math.min(255, Math.max(0, R));
    G = Math.min(255, Math.max(0, G));
    B = Math.min(255, Math.max(0, B));

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  }
}
