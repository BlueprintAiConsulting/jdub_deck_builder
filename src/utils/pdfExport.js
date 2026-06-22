import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatDimension(inches) {
  if (inches == null || isNaN(inches)) return '0"';
  const ft = Math.floor(inches / 12);
  const inn = Math.round(inches % 12);
  if (ft === 0) return `${inn}"`;
  if (inn === 0) return `${ft}'`;
  return `${ft}' ${inn}"`;
}

export function generateDeckSpecsPDF(deckState) {
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
