import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Plus,
  Layers,
  Search,
  Maximize2,
  Minimize2,
  Trash2,
  Save,
  RotateCcw,
  AlertTriangle,
  Users,
  Compass,
  CheckCircle2,
  RefreshCw,
  Info,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { FtthObject, FtthCable, FtthObjectType, CableType, TopologyTraceResult } from '../types/gis';
import { Modal } from '../components/Modal';

// Custom SVG Icons for Leaflet markers based on FTTH Object Types
function createCustomMarkerIcon(type: FtthObjectType, status: string): L.DivIcon {
  let bgColor = '#3b82f6'; // default blue
  let symbol = '•';

  switch (type) {
    case 'OLT':
      bgColor = '#8b5cf6'; // purple
      symbol = 'OLT';
      break;
    case 'ODC':
      bgColor = '#06b6d4'; // cyan
      symbol = 'ODC';
      break;
    case 'ODP':
      bgColor = '#10b981'; // emerald
      symbol = 'ODP';
      break;
    case 'FAT':
      bgColor = '#14b8a6'; // teal
      symbol = 'FAT';
      break;
    case 'TIANG':
      bgColor = '#64748b'; // slate
      symbol = 'T';
      break;
    case 'HANDHOLE':
      bgColor = '#475569'; // dark slate
      symbol = 'HH';
      break;
    case 'PELANGGAN':
      bgColor = '#f59e0b'; // amber
      symbol = 'ONT';
      break;
    case 'JOINT_CLOSURE':
      bgColor = '#f97316'; // orange
      symbol = 'JC';
      break;
    case 'POP':
      bgColor = '#ec4899'; // pink
      symbol = 'POP';
      break;
  }

  if (status === 'FAULT') {
    bgColor = '#ef4444'; // red
  }

  const html = `
    <div style="
      background-color: ${bgColor};
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      cursor: grab;
    ">
      ${symbol}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'ftth-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16]
  });
}

export const GisFtthPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const polylineLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const drawingPolylineRef = useRef<L.Polyline | null>(null);

  const [objects, setObjects] = useState<FtthObject[]>([]);
  const [cables, setCables] = useState<FtthCable[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Active Tool Mode
  const [activeTool, setActiveTool] = useState<'PAN' | 'ADD_OBJECT' | 'DRAW_CABLE'>('PAN');
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Cable drawing vertices
  const [drawnVertices, setDrawnVertices] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [isCableModalOpen, setIsCableModalOpen] = useState(false);

  // Selected Object / Detail Inspector
  const [selectedObject, setSelectedObject] = useState<FtthObject | null>(null);
  const [traceResult, setTraceResult] = useState<TopologyTraceResult | null>(null);
  const [tracing, setTracing] = useState(false);

  // Layer Visibility
  const [layerVisibility, setLayerVisibility] = useState({
    OLT: true,
    ODC: true,
    ODP: true,
    FAT: true,
    TIANG: true,
    HANDHOLE: true,
    PELANGGAN: true,
    JOINT_CLOSURE: true,
    POP: true,
    CABLES: true
  });

  // Cursor coordinates
  const [cursorPos, setCursorPos] = useState({ lat: -6.2088, lng: 106.8456 });

  // Add Object Modal Form
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
  const [newObjType, setNewObjType] = useState<FtthObjectType>('ODP');
  const [newObjCode, setNewObjCode] = useState('');
  const [newObjName, setNewObjName] = useState('');
  const [newObjAddress, setNewObjAddress] = useState('');
  const [newObjCapacity, setNewObjCapacity] = useState('8');
  const [newObjParentId, setNewObjParentId] = useState('');
  const [submittingObject, setSubmittingObject] = useState(false);

  // Add Cable Modal Form
  const [cableCode, setCableCode] = useState('');
  const [cableName, setCableName] = useState('');
  const [cableType, setCableType] = useState<CableType>('DISTRIBUTION');
  const [cableCores, setCableCores] = useState('12');
  const [cableColor, setCableColor] = useState('#3b82f6');
  const [cableStartId, setCableStartId] = useState('');
  const [cableEndId, setCableEndId] = useState('');
  const [submittingCable, setSubmittingCable] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch GIS Data from Backend
  const loadGisData = async () => {
    try {
      const [objRes, cableRes] = await Promise.all([api.getGisObjects(), api.getGisCables()]);
      setObjects(objRes.objects || []);
      setCables(cableRes.cables || []);
    } catch (err) {
      console.error('Gagal memuat data GIS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGisData();
  }, []);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-6.2088, 106.8456],
      zoom: 14,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // OpenStreetMap standard tile provider with required attribution
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | ISP Transdata GIS'
    }).addTo(map);

    polylineLayerGroupRef.current = L.layerGroup().addTo(map);

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorPos({
        lat: Math.round(e.latlng.lat * 1000000) / 1000000,
        lng: Math.round(e.latlng.lng * 1000000) / 1000000
      });
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      // Handled via state ref in window
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if ((window as any).__gisActiveTool === 'ADD_OBJECT') {
        setPendingCoords({ lat, lng });
        setIsObjectModalOpen(true);
      } else if ((window as any).__gisActiveTool === 'DRAW_CABLE') {
        setDrawnVertices((prev) => {
          const updated = [...prev, { latitude: lat, longitude: lng }];
          return updated;
        });
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sync activeTool with window global for Leaflet event listener
  useEffect(() => {
    (window as any).__gisActiveTool = activeTool;
  }, [activeTool]);

  // Update Drawing Polyline on Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (drawingPolylineRef.current) {
      map.removeLayer(drawingPolylineRef.current);
      drawingPolylineRef.current = null;
    }

    if (drawnVertices.length > 0) {
      const latlngs = drawnVertices.map((v) => [v.latitude, v.longitude] as [number, number]);
      drawingPolylineRef.current = L.polyline(latlngs, {
        color: '#f59e0b',
        dashArray: '6, 6',
        weight: 3
      }).addTo(map);
    }
  }, [drawnVertices]);

  // 3. Render Objects as Leaflet Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear existing markers
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    objects.forEach((obj) => {
      const isVisible = (layerVisibility as any)[obj.object_type] ?? true;
      if (!isVisible) return;

      const icon = createCustomMarkerIcon(obj.object_type, obj.status);
      const marker = L.marker([obj.latitude, obj.longitude], {
        icon,
        draggable: true,
        title: `${obj.code}: ${obj.name}`
      });

      // Drag and drop event: updates position and saves to database!
      marker.on('dragend', async (e: any) => {
        const newLatLng = e.target.getLatLng();
        try {
          await api.saveGisObject({
            id: obj.id,
            object_type: obj.object_type,
            code: obj.code,
            name: obj.name,
            latitude: newLatLng.lat,
            longitude: newLatLng.lng,
            status: obj.status,
            port_capacity: obj.port_capacity,
            ports_used: obj.ports_used
          });
          // Update local state
          setObjects((prev) =>
            prev.map((o) => (o.id === obj.id ? { ...o, latitude: newLatLng.lat, longitude: newLatLng.lng } : o))
          );
        } catch (err: any) {
          alert('Gagal menyimpan koordinat baru: ' + err.message);
          marker.setLatLng([obj.latitude, obj.longitude]);
        }
      });

      marker.on('click', () => {
        setSelectedObject(obj);
        setTraceResult(null);
      });

      marker.addTo(map);
      markersRef.current[obj.id] = marker;
    });

    // Auto-fit bounds if objects exist and first load
    if (objects.length > 0 && map) {
      const bounds = L.latLngBounds(objects.map((o) => [o.latitude, o.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [objects, layerVisibility]);

  // 4. Render Cables on Map
  useEffect(() => {
    if (!polylineLayerGroupRef.current) return;
    const group = polylineLayerGroupRef.current;
    group.clearLayers();

    if (!layerVisibility.CABLES) return;

    cables.forEach((cable) => {
      if (!cable.vertices || cable.vertices.length < 2) return;
      const latlngs = cable.vertices.map((v) => [v.latitude, v.longitude] as [number, number]);

      const polyline = L.polyline(latlngs, {
        color: cable.color_hex || '#3b82f6',
        weight: cable.cable_type === 'FEEDER' ? 5 : cable.cable_type === 'DISTRIBUTION' ? 3.5 : 2,
        opacity: 0.85
      });

      polyline.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; color: #0f172a;">
          <div style="font-weight: bold; color: #0284c7;">${cable.cable_code}</div>
          <div>${cable.cable_name}</div>
          <div>Tipe: <b>${cable.cable_type}</b> (${cable.core_count} Core)</div>
          <div>Panjang Rute GIS: <b>${cable.calculated_length_m} meter</b></div>
          <div>Status: <b>${cable.status}</b></div>
        </div>
      `);

      group.addLayer(polyline);
    });
  }, [cables, layerVisibility.CABLES]);

  // Save Object Handler
  const handleSaveObject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCoords) return;

    setSubmittingObject(true);
    try {
      const res = await api.saveGisObject({
        object_type: newObjType,
        code: newObjCode,
        name: newObjName,
        latitude: pendingCoords.lat,
        longitude: pendingCoords.lng,
        address: newObjAddress,
        port_capacity: parseInt(newObjCapacity, 10) || 0,
        parent_object_id: newObjParentId || null
      });

      setObjects((prev) => [...prev, res.object]);
      setIsObjectModalOpen(false);
      setNewObjCode('');
      setNewObjName('');
      setNewObjAddress('');
      setActiveTool('PAN');
    } catch (err: any) {
      alert('Gagal menambahkan objek GIS: ' + err.message);
    } finally {
      setSubmittingObject(false);
    }
  };

  // Save Drawn Cable Handler
  const handleSaveCable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (drawnVertices.length < 2) {
      alert('Kabel minimal harus memiliki 2 titik koordinat.');
      return;
    }

    setSubmittingCable(true);
    try {
      const res = await api.saveGisCable({
        cable_code: cableCode,
        cable_name: cableName,
        cable_type: cableType,
        core_count: parseInt(cableCores, 10) || 12,
        color_hex: cableColor,
        start_object_id: cableStartId || null,
        end_object_id: cableEndId || null,
        vertices: drawnVertices.map((v, idx) => ({
          vertex_order: idx + 1,
          latitude: v.latitude,
          longitude: v.longitude
        }))
      });

      setIsCableModalOpen(false);
      setDrawnVertices([]);
      setActiveTool('PAN');
      setCableCode('');
      setCableName('');
      loadGisData();
    } catch (err: any) {
      alert('Gagal menyimpan rute kabel: ' + err.message);
    } finally {
      setSubmittingCable(false);
    }
  };

  // Delete Object
  const handleDeleteSelectedObject = async () => {
    if (!selectedObject) return;
    if (!confirm(`Hapus objek ${selectedObject.code} (${selectedObject.name}) dari database?`)) return;

    try {
      await api.deleteGisObject(selectedObject.id);
      setObjects((prev) => prev.filter((o) => o.id !== selectedObject.id));
      setSelectedObject(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus objek');
    }
  };

  // Run Impact Analysis (Trace downstream subscribers)
  const handleTraceImpact = async () => {
    if (!selectedObject) return;
    setTracing(true);
    try {
      const res = await api.traceTopologyImpact(selectedObject.id);
      setTraceResult(res);
    } catch (err: any) {
      alert(err.message || 'Gagal menjalankan analisis dampak');
    } finally {
      setTracing(false);
    }
  };

  // Jump to Searched Object
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    const match = objects.find(
      (o) =>
        o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (match) {
      mapInstanceRef.current.flyTo([match.latitude, match.longitude], 17);
      setSelectedObject(match);
    } else {
      alert(`Objek '${searchQuery}' tidak ditemukan.`);
    }
  };

  return (
    <div className={`relative flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-2' : 'h-[calc(100vh-6.5rem)]'}`}>
      {/* Top Floating Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl mb-2 z-10 shadow-lg">
        {/* Tool selector */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setActiveTool('PAN');
              setDrawnVertices([]);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTool === 'PAN'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Pilih / Geser (Pan)
          </button>

          <button
            onClick={() => setActiveTool('ADD_OBJECT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTool === 'ADD_OBJECT'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Objek (Klik Peta)</span>
          </button>

          <button
            onClick={() => setActiveTool('DRAW_CABLE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTool === 'DRAW_CABLE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Gambar Kabel ({drawnVertices.length} Titik)</span>
          </button>

          {activeTool === 'DRAW_CABLE' && drawnVertices.length >= 2 && (
            <button
              onClick={() => setIsCableModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition-colors cursor-pointer"
            >
              Simpan Rute Kabel
            </button>
          )}

          {activeTool === 'DRAW_CABLE' && drawnVertices.length > 0 && (
            <button
              onClick={() => setDrawnVertices([])}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
              title="Reset Titik Jalur"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search & Fullscreen */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode ODP, ODC, atau OLT..."
              className="w-48 pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </form>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh (Fullscreen)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="relative flex-1 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Live Cursor Coordinate Pill */}
        <div className="absolute bottom-3 left-3 z-10 px-3 py-1 rounded-lg bg-slate-950/80 backdrop-blur-xs border border-slate-800 text-[11px] font-mono text-cyan-300 pointer-events-none">
          Lat: {cursorPos.lat.toFixed(6)}, Lng: {cursorPos.lng.toFixed(6)}
        </div>

        {/* Map Legend Floating Box */}
        <div className="absolute top-3 left-3 z-10 p-2.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[11px] text-slate-300 shadow-xl space-y-1.5 max-w-[200px] hidden md:block">
          <div className="font-semibold text-slate-200 pb-1 border-b border-slate-800 text-xs">Legenda GIS Transdata</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> OLT</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> ODC</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> ODP</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Tiang</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Pelanggan</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Closure</span>
          </div>
          <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400">
            Geser pin untuk ubah posisi.
          </div>
        </div>

        {/* Selected Object Detail Inspector (Side overlay) */}
        {selectedObject && (
          <div className="absolute top-3 right-3 bottom-3 w-80 sm:w-96 z-10 p-5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-800 text-xs shadow-2xl overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                    {selectedObject.object_type}
                  </span>
                  <h3 className="font-bold text-sm text-white">{selectedObject.code}</h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedObject(null);
                    setTraceResult(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-3">
                <div>
                  <span className="text-slate-400">Nama Objek:</span>
                  <div className="text-slate-200 font-semibold mt-0.5">{selectedObject.name}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500">Latitude:</span>
                    <div className="text-slate-200">{selectedObject.latitude.toFixed(6)}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Longitude:</span>
                    <div className="text-slate-200">{selectedObject.longitude.toFixed(6)}</div>
                  </div>
                </div>

                {selectedObject.address && (
                  <div>
                    <span className="text-slate-400">Alamat / Patokan:</span>
                    <div className="text-slate-300 mt-0.5">{selectedObject.address}</div>
                  </div>
                )}

                {/* Port Capacity */}
                {(selectedObject.object_type === 'ODC' || selectedObject.object_type === 'ODP' || selectedObject.object_type === 'FAT') && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-slate-300 font-semibold">
                      <span>Kapasitas Port:</span>
                      <span className="text-cyan-400 font-mono">
                        {selectedObject.ports_used} / {selectedObject.port_capacity} Port
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{
                          width: `${selectedObject.port_capacity > 0 ? (selectedObject.ports_used / selectedObject.port_capacity) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Trace Impact Analysis Action */}
                <div className="pt-2">
                  <button
                    onClick={handleTraceImpact}
                    disabled={tracing}
                    className="w-full py-2 px-3 rounded-xl bg-amber-950/50 hover:bg-amber-900/50 border border-amber-800/60 text-amber-300 font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>{tracing ? 'Menganalisis...' : 'Analisis Dampak Gangguan'}</span>
                  </button>
                </div>

                {/* Trace Result Output */}
                {traceResult && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-800/50 space-y-2 animate-in fade-in">
                    <div className="font-semibold text-amber-300 text-xs">Hasil Penelusuran Downstream:</div>
                    <div className="text-[11px] text-slate-300">
                      • Node terhubung downstream: <b>{traceResult.affected_nodes_count} node</b>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      • Pelanggan terdampak: <b>{traceResult.affected_subscribers_count} pelanggan</b>
                    </div>
                    {traceResult.subscribers.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-1 pt-1 border-t border-slate-800 text-[10px] font-mono">
                        {traceResult.subscribers.map((c) => (
                          <div key={c.id} className="text-slate-300 flex justify-between">
                            <span>{c.customer_code} ({c.full_name})</span>
                            <span className="text-cyan-400">{c.service_package}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[10px] text-slate-500">Tersimpan di MariaDB</span>
              <button
                onClick={handleDeleteSelectedObject}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Node</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Tambah Objek GIS */}
      <Modal
        isOpen={isObjectModalOpen}
        onClose={() => setIsObjectModalOpen(false)}
        title="Tambah Objek Jaringan FTTH"
      >
        <form onSubmit={handleSaveObject} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs">
            <div>
              <span className="text-slate-500">Latitude:</span>
              <div className="text-cyan-400">{pendingCoords?.lat.toFixed(6)}</div>
            </div>
            <div>
              <span className="text-slate-500">Longitude:</span>
              <div className="text-cyan-400">{pendingCoords?.lng.toFixed(6)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tipe Objek *</label>
              <select
                value={newObjType}
                onChange={(e) => setNewObjType(e.target.value as FtthObjectType)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="ODP">ODP (Optical Distribution Point)</option>
                <option value="ODC">ODC (Optical Distribution Cabinet)</option>
                <option value="OLT">OLT (Optical Line Terminal)</option>
                <option value="FAT">FAT (Fiber Access Terminal)</option>
                <option value="TIANG">Tiang Fiber</option>
                <option value="HANDHOLE">Handhole / Manhole</option>
                <option value="PELANGGAN">Pelanggan / ONT</option>
                <option value="JOINT_CLOSURE">Joint Closure / Splice</option>
                <option value="POP">POP / Kantor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Kode Identitas Objek *</label>
              <input
                type="text"
                required
                value={newObjCode}
                onChange={(e) => setNewObjCode(e.target.value)}
                placeholder="cth. ODP-TDA-01"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 uppercase font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Deskriptif *</label>
            <input
              type="text"
              required
              value={newObjName}
              onChange={(e) => setNewObjName(e.target.value)}
              placeholder="cth. ODP Tiang Depan Perumahan Melati"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Kapasitas Port</label>
              <input
                type="number"
                value={newObjCapacity}
                onChange={(e) => setNewObjCapacity(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Node Induk (Parent Object)</label>
              <select
                value={newObjParentId}
                onChange={(e) => setNewObjParentId(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Tidak ada (Root / Standalone)</option>
                {objects
                  .filter((o) => o.object_type === 'ODC' || o.object_type === 'OLT')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Alamat / Catatan Lokasi</label>
            <input
              type="text"
              value={newObjAddress}
              onChange={(e) => setNewObjAddress(e.target.value)}
              placeholder="cth. Jl. Merdeka No. 12"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsObjectModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingObject}
              className="px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submittingObject ? 'Menyimpan...' : 'Simpan Objek ke Database'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Simpan Kabel Rute Polyline */}
      <Modal
        isOpen={isCableModalOpen}
        onClose={() => setIsCableModalOpen(false)}
        title="Simpan Jalur Kabel Fiber Optik"
      >
        <form onSubmit={handleSaveCable} className="space-y-4">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <span>Jumlah Titik Koordinat (Vertices):</span>
            <span className="font-mono text-amber-400 font-bold">{drawnVertices.length} Titik</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Kode Kabel *</label>
              <input
                type="text"
                required
                value={cableCode}
                onChange={(e) => setCableCode(e.target.value)}
                placeholder="cth. FEEDER-01-SEC-A"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 uppercase font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Kabel *</label>
              <input
                type="text"
                required
                value={cableName}
                onChange={(e) => setCableName(e.target.value)}
                placeholder="cth. Kabel Feeder OLT ke ODC-01"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tipe Kabel</label>
              <select
                value={cableType}
                onChange={(e) => setCableType(e.target.value as CableType)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="FEEDER">Feeder (Kabel Utama)</option>
                <option value="DISTRIBUTION">Distribusi (ODC ke ODP)</option>
                <option value="DROPCORE">Dropcore (ODP ke ONT)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Jumlah Core</label>
              <input
                type="number"
                value={cableCores}
                onChange={(e) => setCableCores(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Warna Garis Peta</label>
              <input
                type="color"
                value={cableColor}
                onChange={(e) => setCableColor(e.target.value)}
                className="w-full h-9 px-1 py-1 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCableModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingCable}
              className="px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submittingCable ? 'Menyimpan...' : 'Hitung Panjang & Simpan Kabel'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
