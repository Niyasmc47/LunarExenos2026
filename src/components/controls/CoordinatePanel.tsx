import { useEffect, useState } from 'react';
import { useLocationStore } from '../../stores/locationStore';
import { formatCoordinates, LUNAR_PRESETS, validateCoordinates } from '../../utils/lunarCoordinates';
import { insideSite01 } from '../../utils/explorerCoverage';

export function CoordinatePanel() {
  const { selectedLatitude: latitude, selectedLongitude: longitude, setSelectedCoordinates, resetToDefault, setAppScreen } = useLocationStore();
  const [lat, setLat] = useState(String(latitude));
  const [lon, setLon] = useState(String(longitude));
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('All places');
  const [notice, setNotice] = useState('');
  useEffect(() => { setLat(String(latitude)); setLon(String(longitude)); setError(''); setNotice(''); }, [latitude, longitude]);
  const selected = LUNAR_PRESETS.find(p => Math.abs(p.latitude - latitude) < 1e-6 && Math.abs(p.longitude - longitude) < 1e-6);
  const places = LUNAR_PRESETS.filter(p => (kind === 'All places' || p.kind === kind) && (p.name + ' ' + p.description + ' ' + p.category).toLowerCase().includes(query.trim().toLowerCase()));
  const covered = insideSite01(latitude, longitude);
  return <section className="explorer-panel" aria-labelledby="location-heading">
    <div><p className="eyebrow">YOUR STARTING POINT</p><h2 id="location-heading">Choose a location</h2><p className="help-text">Pick a place, enter coordinates, or click the map or globe. Both views share one selection.</p></div>
    <div className="selection-card" aria-live="polite" aria-atomic="true">
      <div className="flex items-center justify-between mb-1">
        <p className="eyebrow mb-0">SELECTED LOCATION</p>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 ${covered ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-[#303238]'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${covered ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
          {covered ? 'LOLA Active' : 'Imagery Only'}
        </span>
      </div>
      <h3>{selected?.name ?? 'Custom location'}</h3>
      <p className="selected-coordinates font-mono bg-[#0c0e11] px-2.5 py-1.5 rounded border border-[#2b2d32] inline-block tracking-tight" data-testid="selected-coordinates">{formatCoordinates({ latitude, longitude }, 5)}</p>
      <p className="help-text">{selected?.description ?? 'Custom coordinates use the explorer’s lunar reference sphere. Confirm the source frame before precise terrain analysis.'}</p>
      {selected && <details><summary>Coordinate source and accuracy</summary><p className="help-text">{selected.kind} · {selected.coordinateNote}</p><a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.sourceLabel} ↗</a><p className="help-text">Catalogue reviewed {selected.reviewedOn}. Review date does not imply a new survey.</p></details>}
      <button type="button" className="text-button" onClick={async () => {
        try { await navigator.clipboard.writeText(latitude + ', ' + longitude); setNotice('Coordinates copied.'); }
        catch { setNotice('Copy unavailable. Select the coordinates above to copy manually.'); }
      }}>Copy decimal coordinates</button><p role="status" className="help-text">{notice}</p>
    </div>
    <section aria-labelledby="catalogue-heading"><h3 id="catalogue-heading">Find a place</h3>
      <label htmlFor="site-search" className="field-label">Search places</label><input id="site-search" type="search" placeholder="Try Apollo or south pole" value={query} onChange={e => setQuery(e.target.value)} />
      <label htmlFor="site-kind" className="field-label">Place type</label><select id="site-kind" value={kind} onChange={e => setKind(e.target.value)}>{['All places', 'Landing site', 'Study region', 'Landmark', 'Reference point'].map(k => <option key={k}>{k}</option>)}</select>
      <p role="status" className="help-text">{places.length} {places.length === 1 ? 'place' : 'places'} found</p>
      <div className="site-list">{places.map(place => <button type="button" key={place.id} aria-pressed={selected?.id === place.id} onClick={() => setSelectedCoordinates(place.latitude, place.longitude, 'preset')}><span>{place.name}</span><small>{place.kind} · {formatCoordinates(place, 2)}</small></button>)}</div>
      {!places.length && <button type="button" className="text-button" onClick={() => { setQuery(''); setKind('All places'); }}>Clear search and filters</button>}
    </section>
    <details className="coordinate-entry"><summary>Enter exact coordinates</summary>
    <form noValidate onSubmit={e => {
      e.preventDefault();
      const result = validateCoordinates(lat.trim() === '' ? NaN : Number(lat), lon.trim() === '' ? NaN : Number(lon));
      if (!result.valid) { setError(result.error!); return; }
      setSelectedCoordinates(Number(lat), Number(lon), 'manual'); setError('');
    }}>
      <div className="coordinate-fields">
        <label htmlFor="latitude">Latitude <span>−90 to +90°</span><input id="latitude" type="number" step="any" inputMode="decimal" value={lat} aria-describedby="coordinate-help coordinate-error" aria-invalid={!!error} onChange={e => { setLat(e.target.value); setError(''); }} /></label>
        <label htmlFor="longitude">Longitude <span>−180 to +180°</span><input id="longitude" type="number" step="any" inputMode="decimal" value={lon} aria-describedby="coordinate-help coordinate-error" aria-invalid={!!error} onChange={e => { setLon(e.target.value); setError(''); }} /></label>
      </div>
      <p id="coordinate-help" className="help-text">Decimal degrees: north/east positive; south/west negative. Latitude is planetocentric.</p>
      <p id="coordinate-error" role="alert" className="error-text">{error}</p>
      <div className="action-row"><button className="primary-button" type="submit">Apply coordinates</button><button className="secondary-button" type="button" onClick={() => { resetToDefault(); setLat(String(LUNAR_PRESETS[1].latitude)); setLon(String(LUNAR_PRESETS[1].longitude)); setError(''); }}>Reset</button></div>
      <div className="pt-2">
        <span className="eyebrow block mb-1.5">QUICK PRESETS</span>
        <div className="flex flex-wrap gap-1">
          {LUNAR_PRESETS.slice(0, 5).map(p => (
            <button
              key={p.id}
              type="button"
              className="px-2 py-0.5 rounded bg-[#15171b] border border-[#303238] hover:border-[#e5c68d] hover:text-[#e5c68d] text-slate-300 text-[11px] font-mono transition-colors"
              onClick={() => setSelectedCoordinates(p.latitude, p.longitude, 'preset')}
            >
              {p.name.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>
    </form>
    </details>
    <div className="coverage-card" data-testid="coverage">
      <h3>{covered ? 'Inside Site01 terrain footprint' : 'Imagery exploration only here'}</h3>
      <p className="help-text">{covered ? 'The local LOLA dataset covers this footprint. Pixel validity, backend availability and complete skyline coverage must be checked in Terrain Explorer.' : 'Global imagery is available; this location is outside the local Site01 terrain footprint. No elevation or terrain visibility is inferred.'}</p>
      <p className="help-text">Map/globe imagery is not elevation. The globe is a reference sphere; its lighting is illustrative.</p>
      {covered && <button type="button" className="secondary-button" onClick={() => setAppScreen('terrain-explorer')}>Inspect terrain data</button>}
    </div>

    <details className="learning-card"><summary>New to lunar exploration?</summary><ol><li>Start with a named site or enter latitude and longitude.</li><li>Use 2D Map for geography, 3D Globe for orientation, or Both views to compare them.</li><li>Try Connecting Ridge to locate the available terrain footprint.</li></ol>
      <p>Azimuth is direction around the horizon: north 0°, east 90°. Elevation is the angle above the local horizontal plane.</p>
      <p>Polar ridges can block a low Sun or Earth. The real skyline requires terrain data. Seeing the Sun or Earth does not by itself guarantee electrical power or a radio link.</p>
      <p>Use Tab to reach controls and Enter to select. Location selection is available through the form and catalogue without a mouse or 3D controls.</p>
    </details>
  </section>;
}
