/**
 * Map Drawing Tools Module
 * 
 * This module provides drawing and measurement tools for the network map:
 * - Distance measurement (ruler tool)
 * - Area measurement (polygon tool)
 * - Annotation drawing (freehand polylines)
 * - Text markers/labels
 * - Tool management and cleanup
 * 
 * Dependencies:
 * - Leaflet map instance (global 'map')
 * - map-utils.js for helper functions
 */

// ============================================================================
// GLOBAL VARIABLES FOR DRAWING TOOLS
// ============================================================================

let activeDrawTool = null; // Current active drawing tool
let measurementLayers = []; // Array to store all measurement/annotation layers
let measurePoints = []; // Points for measurement
let measureLine = null; // Current measurement polyline
let measurePolygon = null; // Current measurement polygon
let measureMarkers = []; // Markers for measurement points
let textMarkers = []; // Text annotation markers
let annotationLayers = []; // Freehand annotation layers
let isDrawingAnnotation = false;
let currentAnnotationPath = [];
let currentAnnotationLine = null;

// ============================================================================
// TOOL ACTIVATION/DEACTIVATION
// ============================================================================

/**
 * Activate a drawing tool
 * @param {string} toolName - 'ruler', 'area', 'annotation', 'text', or 'none'
 */
function activateDrawTool(toolName) {
    // Deactivate previous tool
    deactivateAllTools();
    
    activeDrawTool = toolName;
    
    // Update toolbar button states
    updateToolbarButtons(toolName);
    
    switch(toolName) {
        case 'ruler':
            activateRulerTool();
            break;
        case 'area':
            activateAreaTool();
            break;
        case 'annotation':
            activateAnnotationTool();
            break;
        case 'text':
            activateTextTool();
            break;
        default:
            activeDrawTool = null;
    }
}

/**
 * Deactivate all drawing tools
 */
function deactivateAllTools() {
    // Remove active tool event listeners
    map.off('click', handleRulerClick);
    map.off('click', handleAreaClick);
    map.off('click', handleTextClick);
    map.off('mousedown', handleAnnotationStart);
    map.off('mousemove', handleAnnotationMove);
    map.off('mouseup', handleAnnotationEnd);
    
    // Reset cursor
    document.getElementById('map').style.cursor = '';
    
    // Clean up temporary drawing state
    if (measureLine && !measurePoints.length) {
        map.removeLayer(measureLine);
        measureLine = null;
    }
    
    if (isDrawingAnnotation && currentAnnotationLine) {
        map.removeLayer(currentAnnotationLine);
        currentAnnotationLine = null;
    }
    isDrawingAnnotation = false;
    currentAnnotationPath = [];
    
    activeDrawTool = null;
    updateToolbarButtons(null);
}

/**
 * Update toolbar button visual states
 */
function updateToolbarButtons(activeTool) {
    const buttons = document.querySelectorAll('.map-tool-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tool === activeTool) {
            btn.classList.add('active');
        }
    });
}

// ============================================================================
// RULER TOOL (Distance Measurement)
// ============================================================================

function activateRulerTool() {
    document.getElementById('map').style.cursor = 'crosshair';
    showToast('📏 Ruler Tool: Click points to measure distance. Double-click or press ESC to finish.', 'info', 5000);
    
    // Reset measurement state
    measurePoints = [];
    measureMarkers = [];
    
    map.on('click', handleRulerClick);
    document.addEventListener('keydown', handleRulerKeydown);
    map.on('dblclick', finishRulerMeasurement);
}

function handleRulerClick(e) {
    if (activeDrawTool !== 'ruler') return;
    
    const latlng = e.latlng;
    measurePoints.push(latlng);
    
    // Add point marker
    const pointMarker = L.circleMarker(latlng, {
        radius: 6,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        color: '#fff',
        weight: 2
    }).addTo(map);
    measureMarkers.push(pointMarker);
    measurementLayers.push(pointMarker);
    
    // Draw/update line
    if (measurePoints.length >= 2) {
        if (measureLine) {
            map.removeLayer(measureLine);
        }
        
        measureLine = L.polyline(measurePoints, {
            color: '#3b82f6',
            weight: 3,
            dashArray: '10, 5',
            opacity: 0.8
        }).addTo(map);
        measurementLayers.push(measureLine);
        
        // Calculate and show distance
        const totalDistance = calculateTotalDistance(measurePoints);
        updateDistancePopup(totalDistance, latlng);
    }
}

function handleRulerKeydown(e) {
    if (e.key === 'Escape') {
        finishRulerMeasurement();
    }
}

function finishRulerMeasurement(e) {
    if (e) {
        L.DomEvent.stopPropagation(e);
    }
    
    if (measurePoints.length >= 2) {
        const totalDistance = calculateTotalDistance(measurePoints);
        const midPoint = measurePoints[Math.floor(measurePoints.length / 2)];
        
        // Add permanent distance label
        const distanceLabel = L.marker(midPoint, {
            icon: L.divIcon({
                className: 'distance-label',
                html: `<div class="measurement-label"><i class="bi bi-rulers"></i> ${formatDistance(totalDistance)}</div>`,
                iconSize: [120, 30],
                iconAnchor: [60, 15]
            })
        }).addTo(map);
        measurementLayers.push(distanceLabel);
        
        showToast(`📏 Total Distance: ${formatDistance(totalDistance)}`, 'success');
    }
    
    // Clean up
    document.removeEventListener('keydown', handleRulerKeydown);
    map.off('dblclick', finishRulerMeasurement);
    measurePoints = [];
    measureMarkers = [];
    measureLine = null;
    
    deactivateAllTools();
}

function calculateTotalDistance(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += points[i-1].distanceTo(points[i]);
    }
    return total;
}

function updateDistancePopup(distance, latlng) {
    // Show floating distance indicator
    const popup = L.popup({
        closeButton: false,
        autoClose: false,
        closeOnClick: false,
        className: 'measurement-popup'
    })
    .setLatLng(latlng)
    .setContent(`<strong>${formatDistance(distance)}</strong>`)
    .openOn(map);
    
    // Auto-close after 2 seconds
    setTimeout(() => {
        map.closePopup(popup);
    }, 2000);
}

function formatDistance(meters) {
    if (meters >= 1000) {
        return (meters / 1000).toFixed(2) + ' km';
    }
    return meters.toFixed(1) + ' m';
}

// ============================================================================
// AREA TOOL (Polygon Measurement)
// ============================================================================

function activateAreaTool() {
    document.getElementById('map').style.cursor = 'crosshair';
    showToast('📐 Area Tool: Click points to draw polygon. Double-click or press ESC to finish.', 'info', 5000);
    
    measurePoints = [];
    measureMarkers = [];
    
    map.on('click', handleAreaClick);
    document.addEventListener('keydown', handleAreaKeydown);
    map.on('dblclick', finishAreaMeasurement);
}

function handleAreaClick(e) {
    if (activeDrawTool !== 'area') return;
    
    const latlng = e.latlng;
    measurePoints.push(latlng);
    
    // Add point marker
    const pointMarker = L.circleMarker(latlng, {
        radius: 6,
        fillColor: '#10b981',
        fillOpacity: 1,
        color: '#fff',
        weight: 2
    }).addTo(map);
    measureMarkers.push(pointMarker);
    measurementLayers.push(pointMarker);
    
    // Draw/update polygon preview
    if (measurePoints.length >= 2) {
        if (measurePolygon) {
            map.removeLayer(measurePolygon);
        }
        
        measurePolygon = L.polygon(measurePoints, {
            color: '#10b981',
            weight: 2,
            fillColor: '#10b981',
            fillOpacity: 0.2,
            dashArray: '5, 5'
        }).addTo(map);
        measurementLayers.push(measurePolygon);
    }
    
    if (measurePoints.length >= 3) {
        const area = calculatePolygonArea(measurePoints);
        showToast(`Current area: ${formatArea(area)}`, 'info', 2000);
    }
}

function handleAreaKeydown(e) {
    if (e.key === 'Escape') {
        finishAreaMeasurement();
    }
}

function finishAreaMeasurement(e) {
    if (e) {
        L.DomEvent.stopPropagation(e);
    }
    
    if (measurePoints.length >= 3) {
        const area = calculatePolygonArea(measurePoints);
        const centroid = calculateCentroid(measurePoints);
        
        // Finalize polygon
        if (measurePolygon) {
            measurePolygon.setStyle({
                dashArray: null,
                fillOpacity: 0.3
            });
        }
        
        // Add area label at centroid
        const areaLabel = L.marker(centroid, {
            icon: L.divIcon({
                className: 'area-label',
                html: `<div class="measurement-label area"><i class="bi bi-bounding-box"></i> ${formatArea(area)}</div>`,
                iconSize: [140, 30],
                iconAnchor: [70, 15]
            })
        }).addTo(map);
        measurementLayers.push(areaLabel);
        
        showToast(`📐 Total Area: ${formatArea(area)}`, 'success');
    }
    
    // Clean up
    document.removeEventListener('keydown', handleAreaKeydown);
    map.off('dblclick', finishAreaMeasurement);
    measurePoints = [];
    measureMarkers = [];
    measurePolygon = null;
    
    deactivateAllTools();
}

function calculatePolygonArea(points) {
    // Shoelace formula for polygon area
    if (points.length < 3) return 0;
    
    // Use Leaflet's built-in geodesic area calculation
    const latLngs = points.map(p => [p.lat, p.lng]);
    return L.GeometryUtil ? L.GeometryUtil.geodesicArea(latLngs) : approximateArea(points);
}

function approximateArea(points) {
    // Simple approximation using shoelace formula with lat/lng
    // Convert to meters using approximate conversion
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        // Convert to approximate meters
        const lat1 = points[i].lat * 111320;
        const lng1 = points[i].lng * 111320 * Math.cos(points[i].lat * Math.PI / 180);
        const lat2 = points[j].lat * 111320;
        const lng2 = points[j].lng * 111320 * Math.cos(points[j].lat * Math.PI / 180);
        
        area += lat1 * lng2;
        area -= lat2 * lng1;
    }
    
    return Math.abs(area / 2);
}

function calculateCentroid(points) {
    let latSum = 0, lngSum = 0;
    points.forEach(p => {
        latSum += p.lat;
        lngSum += p.lng;
    });
    return L.latLng(latSum / points.length, lngSum / points.length);
}

function formatArea(sqMeters) {
    if (sqMeters >= 1000000) {
        return (sqMeters / 1000000).toFixed(2) + ' km²';
    } else if (sqMeters >= 10000) {
        return (sqMeters / 10000).toFixed(2) + ' ha';
    }
    return sqMeters.toFixed(1) + ' m²';
}

// ============================================================================
// ANNOTATION TOOL (Freehand Drawing)
// ============================================================================

function activateAnnotationTool() {
    document.getElementById('map').style.cursor = 'crosshair';
    showToast('✏️ Annotation Tool: Click and drag to draw. Release to finish.', 'info', 5000);
    
    map.on('mousedown', handleAnnotationStart);
}

function handleAnnotationStart(e) {
    if (activeDrawTool !== 'annotation') return;
    
    isDrawingAnnotation = true;
    currentAnnotationPath = [e.latlng];
    
    // Disable map dragging while drawing
    map.dragging.disable();
    
    map.on('mousemove', handleAnnotationMove);
    map.on('mouseup', handleAnnotationEnd);
}

function handleAnnotationMove(e) {
    if (!isDrawingAnnotation) return;
    
    currentAnnotationPath.push(e.latlng);
    
    // Update line preview
    if (currentAnnotationLine) {
        map.removeLayer(currentAnnotationLine);
    }
    
    currentAnnotationLine = L.polyline(currentAnnotationPath, {
        color: '#ef4444',
        weight: 3,
        opacity: 0.8
    }).addTo(map);
}

function handleAnnotationEnd(e) {
    if (!isDrawingAnnotation) return;
    
    isDrawingAnnotation = false;
    map.dragging.enable();
    
    map.off('mousemove', handleAnnotationMove);
    map.off('mouseup', handleAnnotationEnd);
    
    if (currentAnnotationPath.length >= 2) {
        // Finalize the annotation
        if (currentAnnotationLine) {
            currentAnnotationLine.setStyle({
                color: '#ef4444',
                weight: 3,
                opacity: 1
            });
            
            // Make it clickable to delete
            currentAnnotationLine.on('click', function() {
                if (confirm('Delete this annotation?')) {
                    map.removeLayer(currentAnnotationLine);
                    const idx = annotationLayers.indexOf(currentAnnotationLine);
                    if (idx > -1) annotationLayers.splice(idx, 1);
                    const mIdx = measurementLayers.indexOf(currentAnnotationLine);
                    if (mIdx > -1) measurementLayers.splice(mIdx, 1);
                }
            });
            
            annotationLayers.push(currentAnnotationLine);
            measurementLayers.push(currentAnnotationLine);
        }
        
        showToast('✏️ Annotation added! Click on it to delete.', 'success');
    }
    
    currentAnnotationPath = [];
    currentAnnotationLine = null;
}

// ============================================================================
// TEXT MARKER TOOL
// ============================================================================

function activateTextTool() {
    document.getElementById('map').style.cursor = 'text';
    showToast('📝 Text Tool: Click on map to add a text label.', 'info', 5000);
    
    map.on('click', handleTextClick);
}

function handleTextClick(e) {
    if (activeDrawTool !== 'text') return;
    
    const latlng = e.latlng;
    
    // Prompt for text
    const text = prompt('Enter label text:', 'Label');
    if (!text) {
        return;
    }
    
    // Create text marker
    const textMarker = L.marker(latlng, {
        icon: L.divIcon({
            className: 'text-marker-label',
            html: `<div class="map-text-label" contenteditable="false">${escapeHtml(text)}</div>`,
            iconSize: [150, 30],
            iconAnchor: [75, 15]
        }),
        draggable: true
    }).addTo(map);
    
    // Click to edit or delete
    textMarker.on('click', function() {
        const action = prompt('Enter new text or type "DELETE" to remove:', text);
        if (action === null) return;
        
        if (action.toUpperCase() === 'DELETE') {
            map.removeLayer(textMarker);
            const idx = textMarkers.indexOf(textMarker);
            if (idx > -1) textMarkers.splice(idx, 1);
            const mIdx = measurementLayers.indexOf(textMarker);
            if (mIdx > -1) measurementLayers.splice(mIdx, 1);
            showToast('Label deleted', 'info');
        } else {
            textMarker.setIcon(L.divIcon({
                className: 'text-marker-label',
                html: `<div class="map-text-label">${escapeHtml(action)}</div>`,
                iconSize: [150, 30],
                iconAnchor: [75, 15]
            }));
        }
    });
    
    textMarkers.push(textMarker);
    measurementLayers.push(textMarker);
    
    showToast('📝 Label added! Click to edit, drag to move.', 'success');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// CLEAR ALL MEASUREMENTS/ANNOTATIONS
// ============================================================================

function clearAllMeasurements() {
    if (!measurementLayers.length) {
        showToast('No measurements to clear', 'info');
        return;
    }
    
    if (confirm('Clear all measurements and annotations?')) {
        measurementLayers.forEach(layer => {
            map.removeLayer(layer);
        });
        measurementLayers = [];
        measureMarkers = [];
        textMarkers = [];
        annotationLayers = [];
        measurePoints = [];
        measureLine = null;
        measurePolygon = null;
        
        showToast('All measurements cleared', 'success');
    }
}

// ============================================================================
// TOOLBAR CREATION
// ============================================================================

/**
 * Create the map tools toolbar
 */
function createMapToolsToolbar() {
    // Check if toolbar already exists
    if (document.getElementById('map-tools-toolbar')) {
        return;
    }
    
    // Create toolbar container
    const toolbar = document.createElement('div');
    toolbar.id = 'map-tools-toolbar';
    toolbar.className = 'map-tools-toolbar';
    toolbar.innerHTML = `
        <div class="toolbar-group">
            <button class="map-tool-btn" data-tool="ruler" onclick="activateDrawTool('ruler')" title="Measure Distance (Ruler)">
                <i class="bi bi-rulers"></i>
            </button>
            <button class="map-tool-btn" data-tool="area" onclick="activateDrawTool('area')" title="Measure Area">
                <i class="bi bi-bounding-box"></i>
            </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
            <button class="map-tool-btn" data-tool="annotation" onclick="activateDrawTool('annotation')" title="Draw Annotation">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="map-tool-btn" data-tool="text" onclick="activateDrawTool('text')" title="Add Text Label">
                <i class="bi bi-fonts"></i>
            </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
            <button class="map-tool-btn danger" onclick="clearAllMeasurements()" title="Clear All Measurements">
                <i class="bi bi-trash"></i>
            </button>
            <button class="map-tool-btn" onclick="deactivateAllTools()" title="Cancel/Deselect Tool">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
    `;
    
    // Add to map container
    const mapCard = document.getElementById('map-card');
    if (mapCard) {
        mapCard.style.position = 'relative';
        mapCard.appendChild(toolbar);
    }
}

// ============================================================================
// COORDINATE DISPLAY
// ============================================================================

/**
 * Create coordinate display that shows cursor position
 */
function createCoordinateDisplay() {
    // Check if display already exists
    if (document.getElementById('coord-display')) {
        return;
    }
    
    const display = document.createElement('div');
    display.id = 'coord-display';
    display.className = 'coord-display';
    display.innerHTML = '<i class="bi bi-geo-alt"></i> <span>Move cursor over map</span>';
    
    const mapCard = document.getElementById('map-card');
    if (mapCard) {
        mapCard.appendChild(display);
    }
    
    // Update on mouse move
    map.on('mousemove', function(e) {
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);
        display.innerHTML = `<i class="bi bi-geo-alt"></i> <span>${lat}, ${lng}</span>`;
    });
    
    // Click to copy coordinates
    display.addEventListener('click', function() {
        const coords = display.querySelector('span').textContent;
        if (coords && coords !== 'Move cursor over map') {
            navigator.clipboard.writeText(coords).then(() => {
                showToast('📋 Coordinates copied!', 'success', 2000);
            });
        }
    });
    display.style.cursor = 'pointer';
    display.title = 'Click to copy coordinates';
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize map tools when DOM is ready
 */
function initMapTools() {
    // Wait for map to be ready
    if (typeof map === 'undefined' || !map) {
        setTimeout(initMapTools, 100);
        return;
    }
    
    createMapToolsToolbar();
    createCoordinateDisplay();
    console.log('✓ Map tools initialized');
}

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', function() {
    // Delay to ensure map is initialized first
    setTimeout(initMapTools, 500);
});

// Export functions for external use
window.activateDrawTool = activateDrawTool;
window.deactivateAllTools = deactivateAllTools;
window.clearAllMeasurements = clearAllMeasurements;
