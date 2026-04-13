import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker } from 'react-leaflet';
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
  const { nodes, edges, failedEdges, activeRoutes, getRouteColor } = useRouteStore();

  const getPolylinePositions = (sourceId, targetId) => {
    const source = nodes.find(n => n.id === sourceId);
    const target = nodes.find(n => n.id === targetId);
    if (source && target) {
      return [[source.lat, source.lng], [target.lat, target.lng]];
    }
    return [];
  };

  const getVehicleColor = (vehicleType) => {
    switch(vehicleType) {
      case 'truck': return '#3B82F6';  // blue
      case 'boat': return '#06B6D4';   // cyan
      case 'drone': return '#A855F7';  // purple
      default: return '#1E293B';       // slate
    }
  };

  // Get active route edge IDs for highlighting
  const activeRouteEdgeIds = new Set();
  activeRoutes.forEach(route => {
    route.edges?.forEach(edge => {
      activeRouteEdgeIds.add(edge.id);
    });
  });

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

      {/* Draw all network edges */}
      {edges.map(edge => {
        const isFlooded = failedEdges.includes(edge.id);
        const isInActiveRoute = activeRouteEdgeIds.has(edge.id);
        
        let color, weight, opacity, dashArray;

        if (isFlooded) {
          color = '#EF4444';  // bright red
          weight = 6;
          opacity = 0.8;
          dashArray = '12, 6';  // dashed
        } else if (isInActiveRoute) {
          // Find which route this edge belongs to and get its vehicle type
          const route = activeRoutes.find(r => r.edges?.some(e => e.id === edge.id));
          color = getVehicleColor(route?.vehicle);
          weight = 7;
          opacity = 1;
          dashArray = null;  // solid
        } else {
          color = getRouteColor(edge.id);
          weight = isInActiveRoute ? 6 : 3;
          opacity = 0.5;
          dashArray = edge.type === 'waterway' ? '5, 10' : edge.type === 'airway' ? '1, 15' : null;
        }

        return (
          <Polyline
            key={edge.id}
            positions={getPolylinePositions(edge.source, edge.target)}
            color={color}
            weight={weight}
            opacity={opacity}
            dashArray={dashArray}
            lineCap="round"
            lineJoin="round"
          >
            <Popup>
              <div className="text-xs p-2 max-w-sm">
                <p className="font-bold text-slate-900 mb-1">{edge.id}</p>
                <div className="space-y-1 text-slate-600 text-xs">
                  <p><span className="font-semibold">Type:</span> {edge.type || 'road'}</p>
                  <p><span className="font-semibold">Time:</span> {edge.base_weight_mins}m</p>
                  <p><span className="font-semibold">Risk:</span> {(edge.risk_score * 100).toFixed(1)}%</p>
                  {isFlooded && <p className="text-red-600 font-bold">🚨 FLOODED</p>}
                  {isInActiveRoute && <p className="text-blue-600 font-bold">✓ In Active Route</p>}
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Draw highlighted routes with all edges in path */}
      {activeRoutes.map((route, routeIdx) => {
        if (!route.path || route.path.length < 2) return null;
        
        const pathPositions = route.path
          .map(nodeId => {
            const node = nodes.find(n => n.id === nodeId);
            return node ? [node.lat, node.lng] : null;
          })
          .filter(Boolean);

        return (
          <Polyline
            key={`route-highlight-${routeIdx}`}
            positions={pathPositions}
            color={getVehicleColor(route.vehicle)}
            weight={9}
            opacity={0.95}
            dashArray={null}
            lineCap="round"
            lineJoin="round"
          >
            <Popup>
              <div className="text-xs p-2 max-w-sm">
                <p className="font-bold text-slate-900">{route.vehicle.toUpperCase()} Route</p>
                <p className="text-slate-600 mt-1"><span className="font-semibold">⏱️ ETA:</span> {route.eta_minutes}m</p>
                <p className="text-slate-600"><span className="font-semibold">📍 Path:</span> {route.path?.join(' → ')}</p>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Draw nodes */}
      {nodes.map(node => {
        const isOrigin = activeRoutes.some(r => r.path?.[0] === node.id);
        const isDestination = activeRoutes.some(r => r.path?.[r.path.length - 1] === node.id);

        return (
          <div key={node.id}>
            <Marker
              position={[node.lat, node.lng]}
              icon={nodeIcon}
            >
              <Popup>
                <div className="text-center p-2">
                  <h3 className="font-bold text-slate-900">{node.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{node.id}</p>
                  <p className="text-xs text-slate-600 capitalize mt-1">
                    {node.type?.replace('_', ' ') || 'Node'}
                  </p>
                  {isOrigin && <p className="text-xs text-blue-600 font-bold mt-1">📍 Origin</p>}
                  {isDestination && <p className="text-xs text-emerald-600 font-bold mt-1">🎯 Destination</p>}
                </div>
              </Popup>
            </Marker>

            {/* Highlight origin with blue circle */}
            {isOrigin && (
              <CircleMarker
                center={[node.lat, node.lng]}
                radius={35}
                fillColor="none"
                color="#3B82F6"
                weight={3}
                opacity={0.8}
                dashArray="5, 5"
              />
            )}

            {/* Highlight destination with green circle */}
            {isDestination && (
              <CircleMarker
                center={[node.lat, node.lng]}
                radius={40}
                fillColor="none"
                color="#10B981"
                weight={3}
                opacity={0.8}
                dashArray="5, 5"
              />
            )}
          </div>
        );
      })}
    </MapContainer>
  );
}
