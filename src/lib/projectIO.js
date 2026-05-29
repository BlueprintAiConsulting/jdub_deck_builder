/**
 * DeckForge Project IO Library
 * Handles serialization, file download (.deck), validation, and localStorage storage.
 */

export const SCHEMA_VERSION = 2;

/**
 * Serialize a project state to a standard JS object.
 */
export function serializeProject(projectName, sections, materials) {
  return {
    schemaVersion: SCHEMA_VERSION,
    projectName,
    sections,
    materials,
    timestamp: new Date().toISOString()
  };
}

/**
 * Downloads a project state as a .deck JSON file.
 */
export function downloadProjectFile(projectName, sections, materials) {
  const data = serializeProject(projectName, sections, materials);
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  // Replace unsafe characters in filename
  const safeName = projectName.replace(/[^a-z0-9_-]/gi, '_') || 'untitled';
  a.href = url;
  a.download = `${safeName}.deck`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Saves a project state to browser localStorage and updates the Recent Projects list.
 */
export function saveProjectToLocalStorage(projectName, sections, materials) {
  try {
    const data = serializeProject(projectName, sections, materials);
    const key = `deckforge_project_${projectName}`;
    localStorage.setItem(key, JSON.stringify(data));

    // Update list of recent projects
    let recent = [];
    try {
      const raw = localStorage.getItem('deckforge_recent_projects');
      recent = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to parse recent projects:', e);
    }

    // Remove existing entry to move it to the front
    recent = recent.filter(name => name !== projectName);
    recent.unshift(projectName);

    // Limit to most recent 20 projects
    if (recent.length > 20) {
      recent = recent.slice(0, 20);
    }

    localStorage.setItem('deckforge_recent_projects', JSON.stringify(recent));
    localStorage.removeItem('deckforge_autosave_draft');
  } catch (error) {
    console.error('Failed to save project to localStorage:', error);
    if (error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      throw new Error('Browser storage is full. Please use "Export" to download your project file (.deck) to prevent losing your work.');
    } else {
      throw new Error('Failed to save project to browser storage. Please check browser settings or use "Export" to download your project file (.deck).');
    }
  }
}

/**
 * Loads a project state from browser localStorage.
 */
export function loadProjectFromLocalStorage(projectName) {
  const key = `deckforge_project_${projectName}`;
  const raw = localStorage.getItem(key);
  if (!raw) {
    throw new Error(`Project "${projectName}" was not found in storage.`);
  }
  const parsed = JSON.parse(raw);
  validateProjectData(parsed);
  return parsed;
}

/**
 * Deletes a project from localStorage.
 */
export function deleteProjectFromLocalStorage(projectName) {
  const key = `deckforge_project_${projectName}`;
  localStorage.removeItem(key);

  let recent = [];
  try {
    const raw = localStorage.getItem('deckforge_recent_projects');
    recent = raw ? JSON.parse(raw) : [];
  } catch (e) {}

  recent = recent.filter(name => name !== projectName);
  localStorage.setItem('deckforge_recent_projects', JSON.stringify(recent));
}

/**
 * Lists all recent project names.
 */
export function listRecentProjects() {
  try {
    const raw = localStorage.getItem('deckforge_recent_projects');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Validates a parsed project object against schemaVersion requirements.
 */
export function validateProjectData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid project data format.');
  }
  if (!data.schemaVersion) {
    throw new Error('Invalid project file: schemaVersion is missing.');
  }
  if (data.schemaVersion === 1) {
    if (Array.isArray(data.sections)) {
      data.sections.forEach((sec) => {
        if (!sec.vertices) {
          const x = sec.x !== undefined ? sec.x : 0;
          const y = sec.y !== undefined ? sec.y : 0;
          const width = sec.width !== undefined ? sec.width : 192;
          const depth = sec.depth !== undefined ? sec.depth : 144;
          sec.vertices = [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + depth },
            { x, y: y + depth }
          ];
        }
      });
    }
    data.schemaVersion = 2;
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion. Found: ${data.schemaVersion}, Expected: ${SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(data.sections)) {
    throw new Error('Invalid project file: sections must be a list.');
  }
  
  // Validate and heal sections/vertices
  data.sections.forEach((sec, idx) => {
    if (!sec || typeof sec !== 'object') {
      throw new Error(`Invalid section at index ${idx}.`);
    }
    if (!sec.id) {
      sec.id = `sec-${idx + 1}`;
    }
    if (sec.width === undefined || isNaN(sec.width) || sec.width <= 0) sec.width = 144;
    if (sec.depth === undefined || isNaN(sec.depth) || sec.depth <= 0) sec.depth = 120;
    if (sec.x === undefined || isNaN(sec.x)) sec.x = 0;
    if (sec.y === undefined || isNaN(sec.y)) sec.y = 0;
    
    if (!Array.isArray(sec.vertices) || sec.vertices.length < 3) {
      sec.vertices = [
        { x: sec.x, y: sec.y },
        { x: sec.x + sec.width, y: sec.y },
        { x: sec.x + sec.width, y: sec.y + sec.depth },
        { x: sec.x, y: sec.y + sec.depth }
      ];
    } else {
      sec.vertices.forEach((v, vIdx) => {
        if (!v || typeof v !== 'object' || typeof v.x !== 'number' || typeof v.y !== 'number' || isNaN(v.x) || isNaN(v.y)) {
          throw new Error(`Invalid vertex coordinates at section ${sec.id} index ${vIdx}.`);
        }
      });
    }
  });

  if (!data.materials || typeof data.materials !== 'object') {
    throw new Error('Invalid project file: materials configuration is missing.');
  }
  return true;
}

/**
 * Parses and validates a loaded File object. Returns a Promise resolving to project state.
 */
export function parseDeckFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const data = JSON.parse(text);
        validateProjectData(data);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsText(file);
  });
}

/**
 * Saves a template state to browser localStorage and updates the Custom Templates list.
 */
export function saveTemplateToLocalStorage(templateName, sections, materials) {
  try {
    const data = {
      schemaVersion: SCHEMA_VERSION,
      templateName,
      sections,
      materials,
      timestamp: new Date().toISOString()
    };
    const key = `deckforge_template_${templateName}`;
    localStorage.setItem(key, JSON.stringify(data));

    let templates = [];
    try {
      const raw = localStorage.getItem('deckforge_custom_templates');
      templates = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to parse custom templates list:', e);
    }

    if (!templates.includes(templateName)) {
      templates.push(templateName);
    }

    localStorage.setItem('deckforge_custom_templates', JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save template to localStorage:', error);
    if (error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      throw new Error('Browser storage is full. Cannot save template.');
    } else {
      throw new Error('Failed to save template to browser storage.');
    }
  }
}

/**
 * Loads a template state from browser localStorage.
 */
export function loadTemplateFromLocalStorage(templateName) {
  const key = `deckforge_template_${templateName}`;
  const raw = localStorage.getItem(key);
  if (!raw) {
    throw new Error(`Template "${templateName}" was not found in storage.`);
  }
  const parsed = JSON.parse(raw);
  validateProjectData(parsed);
  return parsed;
}

/**
 * Deletes a template from localStorage.
 */
export function deleteTemplateFromLocalStorage(templateName) {
  const key = `deckforge_template_${templateName}`;
  localStorage.removeItem(key);

  let templates = [];
  try {
    const raw = localStorage.getItem('deckforge_custom_templates');
    templates = raw ? JSON.parse(raw) : [];
  } catch (e) {}

  templates = templates.filter(name => name !== templateName);
  localStorage.setItem('deckforge_custom_templates', JSON.stringify(templates));
}

/**
 * Lists all custom template names.
 */
export function listCustomTemplates() {
  try {
    const raw = localStorage.getItem('deckforge_custom_templates');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
