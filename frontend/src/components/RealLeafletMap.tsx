'use client';

import React, { useEffect, useRef } from 'react';

interface RealLeafletMapProps {
  busLat: number;
  busLong: number;
  busPlate: string;
  boardingLat: number;
  boardingLong: number;
  boardingName: string;
  alightingLat: number;
  alightingLong: number;
  alightingName: string;
}

export default function RealLeafletMap({
  busLat,
  busLong,
  busPlate,
  boardingLat,
  boardingLong,
  boardingName,
  alightingLat,
  alightingLong,
  alightingName,
}: RealLeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);

  useEffect(() => {
    // Dynamically load Leaflet CSS & JS from CDN for real OpenStreetMap rendering
    if (typeof window === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      initMap();
    };
    document.head.appendChild(script);

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, []);

  const initMap = () => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    if (leafletInstance.current) {
      leafletInstance.current.remove();
    }

    // Initialize Leaflet map centered on bus GPS coordinates
    const map = L.map(mapRef.current).setView([busLat, busLong], 13);
    leafletInstance.current = map;

    // OpenStreetMap Real Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Custom Icon for Bus Dot
    const busIcon = L.divIcon({
      className: 'custom-bus-dot',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-center;">
          <div style="width: 20px; height: 20px; background-color: #f59e0b; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 12px rgba(245, 158, 11, 0.8);"></div>
          <div style="position: absolute; top: -24px; left: -25px; background: #0f172a; color: #f59e0b; font-weight: 900; font-size: 10px; padding: 2px 6px; border-radius: 6px; border: 1px solid #f59e0b; white-space: nowrap;">
            🚌 ${busPlate}
          </div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    // Custom Icon for Boarding Stage Pin
    const boardingIcon = L.divIcon({
      className: 'custom-stage-pin',
      html: `
        <div style="background-color: #10b981; color: #ffffff; font-weight: 900; font-size: 10px; padding: 3px 8px; border-radius: 8px; border: 2px solid #ffffff; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">
          🚏 ${boardingName}
        </div>
      `,
      iconSize: [80, 24],
      iconAnchor: [40, 12],
    });

    // Custom Icon for Alighting Pin
    const alightingIcon = L.divIcon({
      className: 'custom-alighting-pin',
      html: `
        <div style="background-color: #f43f5e; color: #ffffff; font-weight: 900; font-size: 10px; padding: 3px 8px; border-radius: 8px; border: 2px solid #ffffff; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">
          🏁 ${alightingName}
        </div>
      `,
      iconSize: [80, 24],
      iconAnchor: [40, 12],
    });

    // Add Markers to Real Map
    L.marker([busLat, busLong], { icon: busIcon }).addTo(map).bindPopup(`<b>Supermetro Bus ${busPlate}</b><br/>Current GPS Position`);
    L.marker([boardingLat, boardingLong], { icon: boardingIcon }).addTo(map).bindPopup(`<b>Boarding Point:</b> ${boardingName}`);
    L.marker([alightingLat, alightingLong], { icon: alightingIcon }).addTo(map).bindPopup(`<b>Destination:</b> ${alightingName}`);

    // Draw Real Route Line along Thika Superhighway
    const latlngs = [
      [busLat, busLong],
      [boardingLat, boardingLong],
      [alightingLat, alightingLong],
    ];
    L.polyline(latlngs, { color: '#f59e0b', weight: 4, opacity: 0.8, dashArray: '8, 8' }).addTo(map);

    // Fit map bounds to show bus dot and boarding stage together
    map.fitBounds([
      [busLat, busLong],
      [boardingLat, boardingLong],
      [alightingLat, alightingLong],
    ], { padding: [40, 40] });
  };

  return (
    <div className="w-full h-72 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl relative">
      <div ref={mapRef} className="w-full h-full bg-slate-900 z-10" />
    </div>
  );
}
