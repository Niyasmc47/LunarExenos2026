import React, { useEffect } from 'react';
import { useEphemerisStore } from '../../stores/ephemerisStore';
import { useLocationStore } from '../../stores/locationStore';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { EphemerisControlToolbar } from './EphemerisControlToolbar';
import { CelestialSkyRadar } from './CelestialSkyRadar';
import { CelestialBodyCard } from './CelestialBodyCard';
import { EphemerisTimeSeriesChart } from './EphemerisTimeSeriesChart';

export const EphemerisExplorerView: React.FC = () => {
  const {
    positionData,
    timeSeriesData,
    isTimeSeriesLoading,
    computePosition,
    computeTimeSeries,
  } = useEphemerisStore();

  const selectedLat = useLocationStore((state) => state.selectedLatitude);
  const selectedLon = useLocationStore((state) => state.selectedLongitude);
  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);

  const observerLat = currentPointTelemetry?.latitude ?? selectedLat;
  const observerLon = currentPointTelemetry?.longitude ?? selectedLon;

  useEffect(() => {
    computePosition(observerLat, observerLon);
    computeTimeSeries(observerLat, observerLon);
  }, [observerLat, observerLon, computePosition, computeTimeSeries]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden gap-2">
      {/* Top Ephemeris Control Toolbar */}
      <EphemerisControlToolbar observerLat={observerLat} observerLon={observerLon} />

      {/* Main Celestial Analysis Workspace */}
      <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto pr-0.5">
        {/* Top Split: Celestial Sky Radar (Left) + Celestial Body Cards (Right) */}
        <div className="flex flex-col lg:flex-row gap-2 min-h-[340px]">
          {/* Left: Local Sky Dome Polar Projection */}
          <div className="w-full lg:w-[48%] flex flex-col min-h-0">
            <CelestialSkyRadar
              sun={positionData?.sun || null}
              earth={positionData?.earth || null}
              observerLat={observerLat}
              observerLon={observerLon}
            />
          </div>

          {/* Right: Sun and Earth Physical Telemetry Cards */}
          <div className="w-full lg:w-[52%] flex flex-col gap-2 min-h-0">
            <CelestialBodyCard body={positionData?.sun || null} type="Sun" />
            <CelestialBodyCard body={positionData?.earth || null} type="Earth" />
          </div>
        </div>

        {/* Bottom Full-Width Time-Series Trajectory Chart */}
        <div className="h-64 min-h-[240px] shrink-0">
          <EphemerisTimeSeriesChart
            data={timeSeriesData}
            isLoading={isTimeSeriesLoading}
          />
        </div>
      </div>
    </div>
  );
};
