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
  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    throw new Error('Invalid project file: sections must be a non-empty list.');
  }
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
