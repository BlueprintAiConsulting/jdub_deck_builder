import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useDeckStore } from '../store/deckStore';
import { renderBlueprint } from './blueprintRenderer';

function formatDimension(inches) {
  if (inches == null || isNaN(inches)) return '0"';
  const ft = Math.floor(inches / 12);
  const inn = Math.round(inches % 12);
  if (ft === 0) return `${inn}"`;
  if (inn === 0) return `${ft}'`;
  return `${ft}' ${inn}"`;
}

export function generateDeckSpecsPDF(deckState, imageDataUrl) {
  const { sections, sectionCalcs, materials, bom, sqft, projectName } = deckState;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = 20;

  // --- Title & Header ---
  doc.setFontSize(22);
  doc.text(projectName || "Project Deck Specifications", 14, cursorY);
  cursorY += 8;

  doc.setFontSize(11);
  doc.setTextColor(100);
  const dateStr = new Date().toLocaleDateString();
  doc.text(`Generated on: ${dateStr}`, 14, cursorY);
  doc.text(`Total Area: ${sqft} sq ft`, pageWidth - 14, cursorY, { align: 'right' });
  cursorY += 14;

  if (imageDataUrl) {
    // Add layout image
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("Deck Layout", 14, cursorY);
    cursorY += 6;
    
    // Scale image to fit width (max 180mm wide, max 100mm high)
    doc.addImage(imageDataUrl, 'PNG', 14, cursorY, 180, 100, undefined, 'FAST');
    cursorY += 105;
  }

  // --- Global Specs ---
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Global Specifications", 14, cursorY);
  cursorY += 6;

  const globalData = [
    ["Deck Material", materials.deckMaterial, "Species", materials.species],
    ["Joist Size", materials.joistSize, "Post Size", materials.postSize],
    ["Beam Config", materials.beamConfig, "Soil Capacity", `${materials.soilCapacity} PSF`],
    ["Deck Board Size", materials.deckBoardSize, "", ""]
  ];

  autoTable(doc, {
    startY: cursorY,
    head: [],
    body: globalData,
    theme: 'plain',
    styles: { cellPadding: 2, fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: 50 },
      2: { fontStyle: 'bold', cellWidth: 40 },
      3: { cellWidth: 50 }
    }
  });

  cursorY = doc.lastAutoTable.finalY + 12;


  // --- Section Details ---
  doc.setFontSize(16);
  doc.text("Structural Sections", 14, cursorY);
  cursorY += 6;

  sections.forEach((sec, idx) => {
    if (cursorY > 250) { doc.addPage(); cursorY = 20; }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Section ${idx + 1}: ${sec.type === 'landing' ? 'Landing / Stairs' : 'Main Deck'}`, 14, cursorY);
    cursorY += 6;

    const secData = [
      ["Dimensions", `${formatDimension(sec.width)} x ${formatDimension(sec.depth)}`, "Height", formatDimension(sec.height)],
      ["Joist Orientation", sec.joistOrientation || 'vertical', "Decking Orientation", sec.deckingOrientation || 'perpendicular'],
      ["Ledger Attached", sec.ledgerAttached ? 'Yes' : 'No', "Blocking", sec.blockingSpacing ? `Every ${formatDimension(sec.blockingSpacing)}` : 'None'],
      ["Footer Depth", formatDimension(sec.footerDepth), "Footer Protrusion", formatDimension(sec.footerAboveGround)],
      ["Stairs", sec.stairs ? (typeof sec.stairs === 'string' ? sec.stairs : sec.stairs.direction) : 'None', "Railings", Object.entries(sec.railings || {}).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'None']
    ];

    autoTable(doc, {
      startY: cursorY,
      body: secData,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240] },
      styles: { fontSize: 9 },
    });
    
    cursorY = doc.lastAutoTable.finalY + 8;
  });

  // --- Beam & Post Specs ---
  if (cursorY > 220) { doc.addPage(); cursorY = 20; }
  doc.setFontSize(16);
  doc.setFont(undefined, 'normal');
  doc.text("Beam & Post Specifications", 14, cursorY);
  cursorY += 6;

  const beamRows = [];
  sections.forEach((sec, sIdx) => {
    const calcs = sectionCalcs[sec.id];
    if (!calcs || !calcs.beams || !calcs.beams.beams) return;
    
    calcs.beams.beams.forEach((beam, bIdx) => {
      // Find posts for this beam
      const beamPosts = (calcs.posts.posts || []).filter(p => p.beamId === beam.id);
      
      beamRows.push([
        `S${sIdx+1}-B${bIdx+1}`,
        formatDimension(beam.position),
        calcs.beams.config,
        formatDimension(calcs.beams.length * 12),
        beamPosts.length,
        formatDimension(beam.postSpacing || calcs.posts.spacing)
      ]);
    });
  });

  if (beamRows.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [["Beam ID", "Position", "Config", "Length", "Posts", "Max Span"]],
      body: beamRows,
      theme: 'striped',
      styles: { fontSize: 9 }
    });
    cursorY = doc.lastAutoTable.finalY + 12;
  } else {
    doc.setFontSize(10);
    doc.text("No beams required for this configuration.", 14, cursorY);
    cursorY += 12;
  }

  // --- Bill of Materials ---
  doc.addPage();
  cursorY = 20;
  doc.setFontSize(16);
  doc.text("Bill of Materials", 14, cursorY);
  cursorY += 6;

  const categories = {};
  bom.forEach((item) => {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
  });

  const getPrice = (item) => {
    const unitPrices = materials.unitPrices || {};
    const priceKey = (unitPrices[item.size] !== undefined) ? item.size : item.id;
    return unitPrices[priceKey] !== undefined ? unitPrices[priceKey] : 1.00;
  };

  let grandTotal = 0;

  Object.keys(categories).sort().forEach(cat => {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(cat.charAt(0).toUpperCase() + cat.slice(1), 14, cursorY);
    cursorY += 4;

    const rows = categories[cat].map(item => {
      const price = getPrice(item);
      const rowTotal = item.length ? price * item.length * item.quantity : price * item.quantity;
      grandTotal += rowTotal;
      
      return [
        item.description || item.id,
        item.size || '-',
        item.length ? `${item.length}'` : '-',
        item.quantity,
        `$${price.toFixed(2)}`,
        `$${rowTotal.toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: cursorY,
      head: [["Item", "Size", "Length", "Qty", "Unit Price", "Total"]],
      body: rows,
      theme: 'striped',
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    cursorY = doc.lastAutoTable.finalY + 8;
  });

  // Grand Total
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Estimated Total Cost: $${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 14, cursorY, { align: 'right' });

  // Save the PDF
  doc.save(`${(projectName || 'deck-specs').replace(/\s+/g, '_')}.pdf`);
}

export function exportPDF() {
  import('jspdf').then(({ jsPDF }) => {
    const state = useDeckStore.getState();
    const sec = state.sections.find((s) => s.id === state.selectedSectionId) || state.sections[0];
    const deck = { ...state.materials, ...sec };
    const calcs = state.sectionCalcs[sec.id];
    const { bom, sqft } = state;
    const unitPrices = state.materials.unitPrices || {};

    const getItemCost = (item) => {
      const priceKey = (unitPrices && (unitPrices[item.size] !== undefined))
        ? item.size
        : item.id;
      const unitPrice = (unitPrices && unitPrices[priceKey] !== undefined)
        ? unitPrices[priceKey]
        : 1.00;
      const total = item.length
        ? unitPrice * item.length * item.quantity
        : unitPrice * item.quantity;
      return { unitPrice, total };
    };

    const grandTotalCost = bom.reduce((sum, item) => {
      const { total } = getItemCost(item);
      return sum + total;
    }, 0);

    // Create a high-res offscreen canvas to render the blueprint
    const canvas = document.createElement('canvas');
    canvas.width = 1050;
    canvas.height = 700;
    
    // Draw the blueprint layout
    renderBlueprint(
      canvas,
      state.sections,
      state.sectionCalcs,
      state.materials,
      state.showDimensions,
      state.currentProjectName
    );
    
    const imgData = canvas.toDataURL('image/png');

    // Initialize PDF as landscape Letter for Page 1 (Blueprint)
    const doc = new jsPDF('l', 'mm', 'letter');
    doc.addImage(imgData, 'PNG', 15, 10, 250, 167);

    // Add a Portrait Letter page for specs and BOM
    doc.addPage('letter', 'p');

    doc.setFillColor(6, 10, 20);
    doc.rect(0, 0, 216, 30, 'F');
    doc.setTextColor(78, 142, 247);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DeckForge', 14, 18);
    doc.setTextColor(139, 157, 195);
    doc.setFontSize(10);
    doc.text('Deck Design & Material Report', 14, 25);
    
    doc.setTextColor(245, 166, 35);
    doc.setFontSize(9);
    doc.text(`${formatDimension(deck.width)} × ${formatDimension(deck.depth)}  •  ${sqft} sq ft`, 140, 15);
    doc.setTextColor(16, 185, 129); // Green
    doc.setFontSize(10);
    doc.text(`EST. COST: $${grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 140, 22);

    let y = 40;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Deck Specifications', 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const specs = [
      ['Width', formatDimension(deck.width)],
      ['Depth', formatDimension(deck.depth)],
      ['Height', formatDimension(deck.height)],
      ['Square Footage', `${sqft} sq ft`],
      ['Lumber Species', deck.species],
      ['Joist Size', deck.joistSize],
      ['Joist Spacing', `${deck.joistSpacing}" o.c.`],
      ['Beam Config', deck.beamConfig],
      ['Post Size', deck.postSize],
      ['Deck Board', deck.deckBoardSize || '5/4x6'],
      ['Ledger', deck.ledgerAttached ? 'Attached' : 'Freestanding'],
      ['Soil Capacity', `${deck.soilCapacity} psf`],
    ];
    specs.forEach(([label, value]) => {
      doc.setTextColor(100, 116, 139);
      doc.text(label, 14, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(value, 80, y);
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    });

    y += 6;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Structural Summary', 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const structural = [
      ['Max Joist Span', formatDimension(calcs.joists.maxSpan)],
      ['Joist Count', String(calcs.joists.count)],
      ['Beam Count', String(calcs.beams.count)],
      ['Post Count', String(calcs.posts.posts.length)],
      ['Footing Diameter', `${calcs.footings.diameter}"`],
      ['Tributary Area', `${calcs.footings.tributaryArea} sq ft`],
    ];
    structural.forEach(([label, value]) => {
      doc.setTextColor(100, 116, 139);
      doc.text(label, 14, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(value, 80, y);
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    });

    y += 6;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Bill of Materials', 14, y);
    y += 8;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Description', 14, y);
    doc.text('Size', 78, y);
    doc.text('Length', 95, y);
    doc.text('Qty', 112, y);
    doc.text('Unit', 123, y);
    doc.text('Unit Price', 133, y);
    doc.text('Total Cost', 158, y);
    doc.text('Material', 183, y);
    y += 2;
    doc.setDrawColor(200, 210, 220);
    doc.line(14, y, 200, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    bom.forEach((item) => {
      if (y > 260) { doc.addPage(); y = 20; }
      const { unitPrice, total } = getItemCost(item);
      doc.text(item.description, 14, y);
      doc.text(item.size, 78, y);
      doc.text(item.length ? `${item.length}'` : '—', 95, y);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(245, 166, 35);
      doc.text(String(item.quantity), 112, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      
      doc.text(item.unit, 123, y);
      doc.text(`$${unitPrice.toFixed(2)}${item.length ? '/LF' : ''}`, 133, y);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // Green
      doc.text(`$${total.toFixed(2)}`, 158, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      
      doc.text(item.material, 183, y);
      y += 5.5;
    });

    y += 3;
    doc.setDrawColor(200, 210, 220);
    doc.line(14, y, 200, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Parts / Cost:', 60, y);
    
    const totalParts = bom.reduce((sum, item) => sum + item.quantity, 0);
    doc.setTextColor(245, 166, 35);
    doc.text(`${totalParts.toLocaleString()} pcs`, 112, y);
    
    doc.setTextColor(16, 185, 129); // Green
    doc.text(`$${grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 158, y);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      if (i === 1) {
        // Landscape blueprint page footer
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text('Generated by DeckForge  •  Permit Blueprint Page  •  IRC R507 Compliant', 15, 205);
        continue;
      }
      // Portrait page footers
      doc.setFontSize(7);
      doc.setTextColor(139, 157, 195);
      doc.text('Generated by DeckForge  •  IRC R507 Compliant  •  For estimation purposes only', 14, 272);
      doc.text(`Page ${i} of ${pageCount}`, 190, 272);
    }

    doc.save(`DeckForge_${deck.width / 12}x${deck.depth / 12}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }).catch((err) => {
    console.error('Failed to load jsPDF:', err);
    alert('PDF export requires an internet connection for the first use.');
  });
}
