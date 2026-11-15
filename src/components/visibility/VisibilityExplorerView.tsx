import { ResultIntro } from '../ui/MissionSetup';
import React, { useEffect } from 'react';
import { VisibilityControlToolbar } from './VisibilityControlToolbar';
import { VisibilityOverviewCards } from './VisibilityOverviewCards';
import { LocalSkyHorizonChart } from './LocalSkyHorizonChart';
import { VisibilityTimelinesChart } from './VisibilityTimelinesChart';
import { useVisibilityStore } from '../../stores/visibilityStore';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { useLocationStore } from '../../stores/locationStore';

export const VisibilityExplorerView: React.FC = () => {
  const computeInstant = useVisibilityStore((state) => state.computeInstant);
  const computeAnalysis = useVisibilityStore((state) => state.computeAnalysis);
  const instantData = useVisibilityStore((state) => state.instantData);
  const analysisData = useVisibilityStore((state) => state.analysisData);

  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);
  const selectedLat = useLocationStore((state) => state.selectedLatitude);
  const selectedLon = useLocationStore((state) => state.selectedLongitude);
  const observerLat = currentPointTelemetry?.latitude ?? selectedLat;
  const observerLon = currentPointTelemetry?.longitude ?? selectedLon;

  // Initial fetch if no data yet
  useEffect(() => {
    if (!instantData) {
      computeInstant(observerLat, observerLon);
    }
    if (!analysisData) {
      computeAnalysis(observerLat, observerLon);
    }
  }, [observerLat, observerLon]);

  return (
    <div className="w-full h-full flex flex-col gap-2.5 overflow-y-auto pr-1">
      <ResultIntro title="When is the sky clear?" description="Read the timeline to find sunlight and Earth visibility, including terrain obstruction." />
      {/* Simulation Controls Toolbar */}
      <VisibilityControlToolbar />

      {/* Sun, Earth & Combined State Telemetry Cards */}
      <VisibilityOverviewCards />

      {/* 360° Terrain Horizon Skyline & Celestial Projection */}
      <LocalSkyHorizonChart />

      {/* Illumination & Earth Line-of-Sight Opportunity Timelines */}
      <VisibilityTimelinesChart />
    </div>
  );
};
