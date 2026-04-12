import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { useRouteStore } from '../../store/routeStore';
import 'leaflet/dist/leaflet.css';

const nodeIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const floodedIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapBoundsUpdater() {
  const map = useMap();
  const { nodes } = useRouteStore();

  if (nodes.length > 0) {
    const bounds = nodes.map(n => [n.lat, n.lng]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }

  return null;
}

export default function RouteMap() {
  const { nodes, edges, failedEdges, getRouteColor } = useRouteStore();

  const getPolylinePositions = (sourceId, targetId) => {
    const source = nodes.find(n => n.id === sourceId);
    const target = nodes.find(n => n.id === targetId);
    if (source && target) {
      return [[source.lat, source.lng], [target.lat, target.lng]];
    }
    return [];
  };

  return (
    <MapContainer
      center={[24.9, 91.7]}
      zoom={10}
      style={{ height: '100%', width: '100%' }}
      className="rounded-b-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapBoundsUpdater />

      {edges.map(edge => {
        const isFlooded = failedEdges.includes(edge.id);
        const color = isFlooded ? '#C0392B' : getRouteColor(edge.id);
        
        // Mode-specific styling
        const dashArray = isFlooded 
          ? '15, 10' 
          : edge.mode === 'water' ? '5, 10' 
          : edge.mode === 'air' ? '1, 15' 
          : null;
        
        const weight = isFlooded ? 5 : (edge.mode === 'air' ? 2 : 4);
        const opacity = isFlooded ? 0.6 : (edge.mode === 'air' ? 0.4 : 0.8);

        return (
          <Polyline
            key={edge.id}
            positions={getPolylinePositions(edge.source, edge.target)}
            color={color}
            weight={weight}
            opacity={opacity}
            dashArray={dashArray}
          >
            <Popup>
              <div className="text-xs p-1">
                <p className="font-bold text-slate-900 mb-1">{edge.id} ({edge.mode || 'land'})</p>
                <div className="space-y-1 text-slate-600">
                  <p className="flex justify-between gap-4 font-medium italic">Weight: <span>{edge.base_weight_mins}m</span></p>
                  <p className="flex justify-between gap-4 font-medium italic">Risk: <span>{(edge.risk_score * 100).toFixed(1)}%</span></p>
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {nodes.map(node => (
        <Marker
          key={node.id}
          position={[node.lat, node.lng]}
          icon={nodeIcon}
        >
          <Popup>
            <div className="text-center p-1">
              <h3 className="font-bold text-slate-900">{node.name}</h3>
              <p className="text-xs text-slate-500 font-mono">{node.id}</p>
              <p className="text-xs text-slate-600 capitalize mt-1">
                {node.type?.replace('_', ' ') || 'Node'}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
