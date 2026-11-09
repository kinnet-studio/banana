import { Animation, Animator, NumberAnimationHelper } from '@ue-too/animate';
import {
    CameraMuxWithAnimationAndLock,
    ZoomPanPath,
    createCameraMuxWithAnimationAndLock,
    createZoomPanPath,
} from '@ue-too/board';
import {
    BaseAppComponents,
    InitAppOptions,
    baseInitApp,
} from '@ue-too/board-pixi-integration';
import { Point, PointCal } from '@ue-too/math';
import { UPDATE_PRIORITY } from 'pixi.js';
import { toast } from 'sonner';
import Stats from 'stats.js';
import { StationManager } from 'track-layout';
import { TrackGraph } from 'track-layout';
import { TrackAlignedPlatformManager } from 'track-layout';
import { JointDirectionPreferenceMap } from 'track-layout';
import type { TrackSegmentWithCollision } from 'track-layout';
import { intersectionSatisfiesVerticalClearance } from 'track-layout';
import { CatenaryLayoutEngine } from 'track-layout/editing';
import { createCatenaryLayoutStateMachine } from 'track-layout/editing';
import { CurveCreationEngine } from 'track-layout/editing';
import { DuplicateToSideEngine } from 'track-layout/editing';
import { createDuplicateToSideStateMachine } from 'track-layout/editing';
import { createJointDirectionStateMachine } from 'track-layout/editing';
import { LayoutStateMachine } from 'track-layout/editing';
import { createLayoutStateMachine } from 'track-layout/editing';
import {
    JointDirectionRenderSystem,
    StationRenderSystem,
    TrackAlignedPlatformRenderSystem,
    TrackRenderSystem,
    WorldRenderSystem,
} from 'track-layout/pixi';
import {
    DualSpinePlacementEngine,
    SingleSpinePlacementEngine,
    StationPlacementEngine,
    createDualSpinePlacementStateMachine,
    createSingleSpinePlacementStateMachine,
    createStationPlacementStateMachine,
} from 'track-layout/station-placement';

import { BuildingManager, BuildingRenderSystem } from '@/buildings';
import i18n from '@/i18n';
import {
    CarCargoStore,
    PlatformBufferStore,
    type PlatformHandle,
    SourceSinkTicker,
    TransferManager,
} from '@/resources';
import {
    BlockSignalManager,
    SignalRenderSystem,
    SignalStateEngine,
} from '@/signals';
import { useGaugeStore } from '@/stores/gauge-store';
import { TerrainData } from '@/terrain/terrain-data';
import { TerrainRenderSystem } from '@/terrain/terrain-render-system';
import { TimeManager } from '@/time';
import { ScheduleClock, TimetableManager } from '@/timetable';
import { AutoCoupler } from '@/trains/auto-coupler';
import { CarImageRegistry } from '@/trains/car-image-registry';
import { CarStockManager } from '@/trains/car-stock-manager';
import { CarTemplateStore } from '@/trains/car-template-store';
import { CollisionGuard, CrossingMap } from '@/trains/collision-guard';
import { Train, type TrainPosition } from '@/trains/formation';
import { FormationManager } from '@/trains/formation-manager';
import { FormationTemplateStore } from '@/trains/formation-template-store';
import {
    KmtExpandedStateMachine,
    createKmtInputStateMachineExpansion,
} from '@/trains/input-state-machine/kmt-state-machine-extension';
import type { JointDirectionManager } from '@/trains/input-state-machine/train-kmt-state-machine';
import {
    DefaultJointDirectionManager,
    TrainPlacementEngine,
    TrainPlacementStateMachine,
} from '@/trains/input-state-machine/train-kmt-state-machine';
import { StationPresenceDetector } from '@/trains/station-presence-detector';
import { DebugOverlayRenderSystem } from '@/trains/tracks/debug-overlay-render-system';
import {
    type ParallelTrackOptions,
    type ProceduralTrackOptions,
    generateParallelTracks,
    generateProceduralTrackPath,
} from '@/trains/tracks/procedural-tracks';
import { TrainManager } from '@/trains/train-manager';
import { TrainRenderSystem } from '@/trains/train-render-system';
import { createWindowToWorld } from '@/utils/window-to-world';

export type FocusAnimationParams = {
    startWorldPoint: Point;
    targetWorldPoint: Point;
    startZoom: number;
    targetZoom: number;
};

export type BananaAppComponents = BaseAppComponents & {
    scheduleClock: ScheduleClock;
    timetableManager: TimetableManager;
    /** Mutable ref so the TimeManager callback always uses the current timetable manager. */
    timetableRef: { current: TimetableManager };
    curveEngine: CurveCreationEngine;
    trackGraph: TrackGraph;
    duplicateToSideEngine: DuplicateToSideEngine;
    catenaryLayoutEngine: CatenaryLayoutEngine;
    worldRenderSystem: WorldRenderSystem;
    terrainData: TerrainData;
    terrainRenderSystem: TerrainRenderSystem;
    trackRenderSystem: TrackRenderSystem;
    trainRenderSystem: TrainRenderSystem;
    buildingManager: BuildingManager;
    buildingRenderSystem: BuildingRenderSystem;
    trainPlacementEngine: TrainPlacementEngine;
    trainManager: TrainManager;
    carStockManager: CarStockManager;
    formationManager: FormationManager;
    jointDirectionManager: JointDirectionManager;
    jointDirectionPreferenceMap: JointDirectionPreferenceMap;
    jointDirectionRenderSystem: JointDirectionRenderSystem;
    layoutStateMachine: LayoutStateMachine;
    kmtStateMachineExpansion: KmtExpandedStateMachine;
    trainStateMachine: TrainPlacementStateMachine;
    debugOverlayRenderSystem: DebugOverlayRenderSystem;
    carImageRegistry: CarImageRegistry;
    carTemplateStore: CarTemplateStore;
    formationTemplateStore: FormationTemplateStore;
    timeManager: TimeManager;
    cameraMux: CameraMuxWithAnimationAndLock;
    startFocusAnimation: (params: FocusAnimationParams) => void;
    startFollowAnimation: (
        params: FocusAnimationParams,
        getPosition: () => Point | null
    ) => void;
    stopFollowing: () => void;
    isFollowing: () => boolean;
    animations: Animator[];
    stationManager: StationManager;
    stationRenderSystem: StationRenderSystem;
    trackAlignedPlatformManager: TrackAlignedPlatformManager;
    trackAlignedPlatformRenderSystem: TrackAlignedPlatformRenderSystem;
    blockSignalManager: BlockSignalManager;
    signalStateEngine: SignalStateEngine;
    signalRenderSystem: SignalRenderSystem;
    stationPresenceDetector: StationPresenceDetector;
    carCargoStore: CarCargoStore;
    platformBufferStore: PlatformBufferStore;
    transferManager: TransferManager;
    sourceSinkTicker: SourceSinkTicker;
    /** The stats.js DOM element for toggling visibility. */
    statsDom: HTMLDivElement;
    /** Add a train at the given segment and t. For stress testing. */
    addTrainAtPosition: (
        segmentNumber: number,
        tValue: number,
        direction: 'tangent' | 'reverseTangent'
    ) => boolean;
    /** Add multiple trains on the first segment for performance testing. Returns number added. */
    addStressTestTrains: (count: number) => number;
    /** Generate a procedural track path for stress testing. Returns number of segments created. */
    generateProceduralTracks: (options: ProceduralTrackOptions) => number;
    /** Spawn N parallel straight tracks, each with one train. Returns number spawned. */
    spawnParallelTracksWithTrains: (
        count: number,
        startX?: number,
        startY?: number
    ) => number;
};

/**
 * Initialize the banana PixiJS application with all subsystems.
 *
 * @param canvas - The canvas element to render to
 * @param option - Initialization options forwarded to baseInitApp
 * @returns Resolved banana app components including all render/management systems
 */
export const initApp = async (
    canvas: HTMLCanvasElement,
    option: Partial<InitAppOptions> = { fullScreen: false }
): Promise<BananaAppComponents> => {
    const baseComponents = await baseInitApp(canvas, option);

    // FPS / performance monitoring with stats.js
    const stats = new Stats();
    stats.showPanel(0); // 0: FPS, 1: MS, 2: MB
    stats.dom.style.position = 'fixed';
    stats.dom.style.top = '4rem';
    stats.dom.style.right = '0';
    stats.dom.style.left = 'auto';
    stats.dom.style.zIndex = '10000';
    document.body.appendChild(stats.dom);
    const statsTick = (): void => {
        stats.update();
    };
    baseComponents.app.ticker.add(statsTick);
    // In dev mode, React's profiler accumulates PerformanceMeasure/PerformanceMark
    // entries indefinitely, consuming ~120 MB+ in long sessions with many trains.
    // Periodically clear them so they don't bloat the heap.
    let perfCleanupInterval: ReturnType<typeof setInterval> | undefined;
    if (import.meta.env.DEV) {
        perfCleanupInterval = setInterval(() => {
            performance.clearMeasures();
            performance.clearMarks();
        }, 60_000);
    }

    baseComponents.cleanups.push(() => {
        baseComponents.app.ticker.remove(statsTick);
        if (stats.dom.parentElement) {
            stats.dom.parentElement.removeChild(stats.dom);
        }
        if (perfCleanupInterval !== undefined)
            clearInterval(perfCleanupInterval);
    });

    baseComponents.camera.setMaxZoomLevel(30);

    const timeManager = new TimeManager(baseComponents.app);

    const animations: Animator[] = [];

    // The path of the focus flight in progress. createZoomPanPath (Van Wijk &
    // Nuij, "Smooth and efficient zooming and panning") zooms out on a long
    // trip, glides across, and zooms back in, so the target never drifts off
    // screen the way it does when pan and zoom are interpolated separately.
    let focusPath: ZoomPanPath | null = null;

    // The Animation<number> drives a normalised progress t ∈ [0, 1].
    // The ease function provides acceleration/deceleration on top of
    // the path's constant perceived speed.
    const focusAnimation = new Animation(
        [
            { percentage: 0, value: 0 },
            { percentage: 1, value: 1 },
        ],
        (t: number) => {
            if (focusPath === null) return;
            const { position, zoomLevel } = focusPath.at(t);
            cameraMux.notifyZoomInputAnimation(zoomLevel);
            baseComponents.cameraRig.zoomTo(zoomLevel);
            cameraMux.notifyPanToAnimationInput(position);
            baseComponents.cameraRig.panToWorld(position);
        },
        new NumberAnimationHelper(),
        1000
    );

    focusAnimation.easeFunction = (x: number): number => {
        return -(Math.cos(Math.PI * x) - 1) / 2;
    };

    const startFocusAnimation = (params: FocusAnimationParams): void => {
        const { startWorldPoint, targetWorldPoint, startZoom, targetZoom } =
            params;
        focusPath = createZoomPanPath(
            { position: startWorldPoint, zoomLevel: startZoom },
            { position: targetWorldPoint, zoomLevel: targetZoom },
            baseComponents.camera.viewPortWidth
        );

        cameraMux.initatePanTransition();
        cameraMux.initateZoomTransition();
        focusAnimation.start();
    };

    // --- Lock-on / follow train ---
    // After the focus animation completes, the pan state machine transitions to
    // LOCKED_ON_OBJECT. On each tick we feed the train's current position via
    // lockedOnObjectPanToInput, which keeps the camera centered on the moving
    // train while blocking normal user panning.
    let followPositionGetter: (() => Point | null) | null = null;

    const stopFollowing = (): void => {
        followPositionGetter = null;
        cameraMux.panStateMachine.happens('unlock');
    };

    const startFollowAnimation = (
        _params: FocusAnimationParams,
        getPosition: () => Point | null
    ): void => {
        // If already following, stop first.
        if (followPositionGetter) {
            stopFollowing();
        }

        followPositionGetter = getPosition;

        // Directly lock onto the train — no transition animation.
        // Set camera to the train's current position and enter LOCKED_ON_OBJECT.
        const pos = getPosition();
        if (pos) {
            baseComponents.cameraRig.panToWorld(pos);
            baseComponents.cameraRig.zoomTo(_params.targetZoom);
            cameraMux.panStateMachine.happens('lockedOnObjectPanToInput', {
                target: pos,
            });
        }
    };

    const isFollowing = (): boolean => followPositionGetter !== null;

    // HIGH priority so the camera-follow target is updated *before*
    // board-pixi-integration's NORMAL-priority callback copies the camera
    // transform onto the stage. TimeManager (also HIGH, registered earlier)
    // moves trains first; this callback then reads the new train position
    // and updates the camera; board-pixi syncs the stage transform last.
    baseComponents.app.ticker.add(
        (time: { deltaMS: number }) => {
            for (const animation of animations) {
                animation.animate(time.deltaMS);
            }
            focusAnimation.animate(time.deltaMS);

            // While locked on, continuously update camera to follow the train.
            if (followPositionGetter) {
                const pos = followPositionGetter();
                if (pos) {
                    const res = cameraMux.panStateMachine.happens(
                        'lockedOnObjectPanToInput',
                        { target: pos }
                    );
                    if (res.handled) {
                        baseComponents.cameraRig.panToWorld(pos);
                    }
                }
            }
        },
        undefined,
        UPDATE_PRIORITY.HIGH
    );

    const trackGraph = new TrackGraph();
    const windowToWorld = createWindowToWorld(
        baseComponents.canvasProxy,
        baseComponents.camera
    );
    const curveEngine = new CurveCreationEngine(trackGraph, windowToWorld);
    const layoutSubStateMachine = createLayoutStateMachine(curveEngine);
    const worldRenderSystem = new WorldRenderSystem();

    // Terrain: 10000x10000m grid centered on origin, 25m cell size, flat at ground level
    const terrainData = TerrainData.createFlat({
        originX: -5000,
        originY: -5000,
        cellsX: 400,
        cellsY: 400,
        cellSize: 25,
    });
    const terrainRenderSystem = new TerrainRenderSystem(
        worldRenderSystem,
        terrainData,
        { renderer: baseComponents.app.renderer }
    );

    const duplicateToSideEngine = new DuplicateToSideEngine(
        trackGraph,
        windowToWorld
    );
    const duplicateSubStateMachine = createDuplicateToSideStateMachine(
        duplicateToSideEngine
    );

    const catenaryLayoutEngine = new CatenaryLayoutEngine(
        trackGraph,
        windowToWorld
    );
    const catenarySubStateMachine =
        createCatenaryLayoutStateMachine(catenaryLayoutEngine);

    catenaryLayoutEngine.onCommit(({ segmentNumber, side }) => {
        trackGraph.setSegmentStyle(segmentNumber, {
            electrified: true,
            catenarySide: side,
        });
    });
    const jointDirectionPreferenceMap = new JointDirectionPreferenceMap();

    const jointDirectionRenderSystem = new JointDirectionRenderSystem(
        worldRenderSystem,
        trackGraph,
        jointDirectionPreferenceMap,
        baseComponents.camera
    );

    const jointDirectionSubStateMachine = createJointDirectionStateMachine({
        setup: () => {},
        cleanup: () => {},
        convert2WorldPosition: windowToWorld,
        getHoveredSwitchJoint: worldPos => {
            const joints = trackGraph.getJoints();
            let closestJoint: number | null = null;
            let closestDist = 30 / baseComponents.camera.zoomLevel;
            for (const { jointNumber, joint } of joints) {
                if (
                    joint.direction.tangent.size <= 1 &&
                    joint.direction.reverseTangent.size <= 1
                )
                    continue;
                const dist = PointCal.distanceBetweenPoints(
                    worldPos,
                    joint.position
                );
                if (dist < closestDist) {
                    closestDist = dist;
                    closestJoint = jointNumber;
                }
            }
            return closestJoint;
        },
        showHoverIndicator: jointNumber => {
            jointDirectionRenderSystem.showHoverIndicator(jointNumber);
        },
        clearHoverIndicator: () => {
            jointDirectionRenderSystem.clearHoverIndicator();
        },
        selectJoint: jointNumber => {
            jointDirectionRenderSystem.selectJoint(jointNumber);
        },
        deselectJoint: () => {
            jointDirectionRenderSystem.deselectJoint();
        },
        cycleDirection: (jointNumber, direction) => {
            const joint = trackGraph.getJoint(jointNumber);
            if (!joint) return;
            const available = joint.direction[direction];
            if (available.size <= 1) return;
            jointDirectionPreferenceMap.cycle(
                jointNumber,
                direction,
                available
            );
            jointDirectionRenderSystem.refresh();
        },
        getSelectedJointTangent: () => {
            const selected = jointDirectionRenderSystem.selectedJoint;
            if (selected === null) return null;
            const joint = trackGraph.getJoint(selected);
            return joint?.tangent ?? null;
        },
        getSelectedJointPosition: () => {
            const selected = jointDirectionRenderSystem.selectedJoint;
            if (selected === null) return null;
            const joint = trackGraph.getJoint(selected);
            return joint?.position ?? null;
        },
    });

    const trackRenderSystem = new TrackRenderSystem(
        worldRenderSystem,
        trackGraph.trackCurveManager,
        baseComponents.camera,
        {
            textureRenderer: { renderer: baseComponents.app.renderer },
            terrain: terrainData,
            curveCreation: curveEngine,
            duplicateToSide: duplicateToSideEngine,
            catenaryLayout: catenaryLayoutEngine,
        }
    );
    const buildingManager = new BuildingManager();
    const buildingRenderSystem = new BuildingRenderSystem(
        worldRenderSystem,
        buildingManager
    );

    const stationManager = new StationManager();
    const stationRenderSystem = new StationRenderSystem(
        worldRenderSystem,
        stationManager,
        trackGraph,
        { renderer: baseComponents.app.renderer }
    );

    const trackAlignedPlatformManager = new TrackAlignedPlatformManager();
    const trackAlignedPlatformRenderSystem =
        new TrackAlignedPlatformRenderSystem(
            worldRenderSystem,
            trackAlignedPlatformManager,
            stationManager,
            trackGraph,
            { renderer: baseComponents.app.renderer }
        );

    trackGraph.setSegmentProtectionCheck(segNum => {
        return (
            trackAlignedPlatformManager.getPlatformsBySegment(segNum).length > 0
        );
    });

    const trainManager = new TrainManager();
    const carStockManager = new CarStockManager();
    const formationManager = new FormationManager(carStockManager);
    const jointDirectionManager = new DefaultJointDirectionManager(
        trackGraph,
        jointDirectionPreferenceMap
    );
    const trainPlacementEngine = new TrainPlacementEngine(
        baseComponents.canvasProxy,
        trackGraph,
        baseComponents.camera,
        {
            onPlaced: placed => {
                // Detach the formation from the manager — it's now owned by the placed train
                formationManager.detachFormation(placed.formation.id);
                trainManager.addTrain(placed);
                // Reset to default formation for next placement
                trainPlacementEngine.setFormation(null);
                toast.success('Train placed on the simulation map');
                return new Train(null, trackGraph, jointDirectionManager);
            },
        }
    );
    const carImageRegistry = new CarImageRegistry();
    const carTemplateStore = new CarTemplateStore();
    const formationTemplateStore = new FormationTemplateStore();
    const trainRenderSystem = new TrainRenderSystem(
        worldRenderSystem,
        () => trainManager.getPlacedTrains(),
        () => trainPlacementEngine.train,
        trackGraph,
        trackRenderSystem,
        { renderer: baseComponents.app.renderer },
        carImageRegistry
    );
    // const layoutStateMachine = createLayoutStateMachine(curveEngine);
    const trainStateMachine = new TrainPlacementStateMachine(
        trainPlacementEngine
    );
    const stationPlacementEngine = new StationPlacementEngine(
        trackGraph,
        windowToWorld,
        stationManager,
        stationRenderSystem,
        () => useGaugeStore.getState().currentGauge
    );
    const stationStateMachine = createStationPlacementStateMachine(
        stationPlacementEngine
    );

    let platformHintToastId: string | number | undefined;
    const showPlatformHint = (key: string) => {
        if (platformHintToastId !== undefined)
            toast.dismiss(platformHintToastId);
        const msg = i18n.t(key);
        if (key === 'hintPlatformCreated') {
            platformHintToastId = toast.success(msg, { duration: 2000 });
        } else {
            platformHintToastId = toast.info(msg, { duration: 8000 });
        }
    };

    const singleSpineEngine = new SingleSpinePlacementEngine(
        trackGraph,
        windowToWorld,
        stationManager,
        trackAlignedPlatformManager,
        trackAlignedPlatformRenderSystem,
        showPlatformHint
    );
    const singleSpineStateMachine =
        createSingleSpinePlacementStateMachine(singleSpineEngine);

    const dualSpineEngine = new DualSpinePlacementEngine(
        trackGraph,
        windowToWorld,
        stationManager,
        trackAlignedPlatformManager,
        trackAlignedPlatformRenderSystem,
        showPlatformHint
    );
    const dualSpineStateMachine =
        createDualSpinePlacementStateMachine(dualSpineEngine);

    const debugOverlayRenderSystem = new DebugOverlayRenderSystem(
        worldRenderSystem,
        trackGraph,
        baseComponents.camera
    );
    debugOverlayRenderSystem.setPlacedTrainsGetter(() =>
        trainManager.getPlacedTrains()
    );
    debugOverlayRenderSystem.setStationManager(stationManager);
    debugOverlayRenderSystem.setTrackAlignedPlatformManager(
        trackAlignedPlatformManager
    );
    debugOverlayRenderSystem.setProximityDetector(
        trainRenderSystem.proximityDetector
    );

    // Share the proximity detector with the train manager for coupling queries
    trainManager.setProximityDetector(trainRenderSystem.proximityDetector);

    const scheduleClock = new ScheduleClock();
    // Mutable ref so that the TimeManager callback always uses the current
    // timetable manager, even after deserialization replaces it.
    const timetableRef: { current: TimetableManager } = { current: null! };
    let timetableManager = new TimetableManager(
        scheduleClock,
        trackGraph,
        trainManager,
        stationManager,
        undefined,
        undefined,
        jointDirectionPreferenceMap
    );
    timetableRef.current = timetableManager;

    // Block signal system
    const blockSignalManager = new BlockSignalManager();
    const signalStateEngine = new SignalStateEngine(blockSignalManager);
    const signalRenderSystem = new SignalRenderSystem(
        worldRenderSystem,
        trackGraph,
        blockSignalManager,
        signalStateEngine,
        { renderer: baseComponents.app.renderer }
    );
    timetableManager.signalStateEngine = signalStateEngine;
    timetableManager.trackAlignedPlatformManager = trackAlignedPlatformManager;

    // Station presence detection
    const stationPresenceDetector = new StationPresenceDetector(
        stationManager,
        trackAlignedPlatformManager,
        trackGraph
    );
    trainRenderSystem.setStationPresenceDetector(stationPresenceDetector);
    trackAlignedPlatformManager.onChange(() =>
        stationPresenceDetector.rebuildIndex()
    );
    stationManager.onChange(() => stationPresenceDetector.rebuildIndex());

    const carCargoStore = new CarCargoStore();
    const platformBufferStore = new PlatformBufferStore();
    const transferManager = new TransferManager({
        carCargoStore,
        platformBufferStore,
        getTrainById: id => trainManager.getTrainById(id),
        // TimeManager.currentTime is epoch ms; convert to seconds for sim time.
        getSimTime: () => timeManager.currentTime / 1000,
    });
    const sourceSinkTicker = new SourceSinkTicker(platformBufferStore);

    // Platform/station destruction → resource cleanup.
    // Must be registered after platformBufferStore and transferManager exist.
    stationManager.setOnDestroyStation(stationId => {
        const station = stationManager.getStation(stationId);
        if (station) {
            // Island platforms belong directly to the station entity.
            for (const platform of station.platforms) {
                const handle: PlatformHandle = {
                    kind: 'island',
                    stationId,
                    platformId: platform.id,
                };
                transferManager.endAllAtPlatform(handle);
                platformBufferStore.destroyPlatform(handle);
            }
            // Track-aligned platform IDs are listed in station.trackAlignedPlatforms;
            // the actual entities are still alive here because destroyPlatform on
            // trackAlignedPlatformManager fires _onBeforeDestroy first, which
            // will handle resource cleanup. We only need the entity destruction
            // here; its removal event takes the platform's visuals away.
        }
        const tapPlatforms =
            trackAlignedPlatformManager.getPlatformsByStation(stationId);
        for (const { id } of tapPlatforms) {
            trackAlignedPlatformManager.destroyPlatform(id);
        }
    });

    // Track-aligned platform destroyed individually (not via station cascade).
    trackAlignedPlatformManager.setOnBeforeDestroy((id, platform) => {
        const handle: PlatformHandle = {
            kind: 'trackAligned',
            stationId: platform.stationId,
            platformId: id,
        };
        transferManager.endAllAtPlatform(handle);
        platformBufferStore.destroyPlatform(handle);
    });

    const unsubscribeResourceTransfer = stationPresenceDetector.subscribe(
        event => {
            if (event.type === 'arrived') {
                const handle: PlatformHandle = {
                    kind: event.presence.platformKind,
                    stationId: event.presence.stationId,
                    platformId: event.presence.platformId,
                };
                transferManager.begin(event.trainId, handle);
            } else {
                transferManager.end(event.trainId);
            }
        }
    );
    baseComponents.cleanups.push(() => unsubscribeResourceTransfer());
    trainRenderSystem.setTransferManager(transferManager);
    trainRenderSystem.setSourceSinkTicker(sourceSinkTicker);

    // Collision prevention system
    const crossingMap = new CrossingMap();
    const collisionGuard = new CollisionGuard(trackGraph, crossingMap);
    trainRenderSystem.collisionGuard = collisionGuard;
    const couplingApproachDetector = trainRenderSystem.couplingApproachDetector;
    collisionGuard.setCouplingApproachDetector(couplingApproachDetector);
    const autoCoupler = new AutoCoupler(
        couplingApproachDetector,
        trainManager,
        {
            onSuccess: () => {
                toast.success(i18n.t('couplingAutoSuccess'));
            },
            onFailure: reason => {
                if (reason === 'depth_exceeded') {
                    toast.warning(i18n.t('couplingDepthExceeded'));
                }
            },
        }
    );

    const trackCurveManager = trackGraph.trackCurveManager;

    function addSegmentCrossings(
        curveNumber: number,
        segment: TrackSegmentWithCollision
    ) {
        for (const col of segment.collision) {
            // Resolve the other segment's number by matching the BCurve reference
            for (const otherNum of trackCurveManager.livingEntities) {
                if (otherNum === curveNumber) continue;
                const otherSeg =
                    trackCurveManager.getTrackSegmentWithJoints(otherNum);
                if (!otherSeg || otherSeg.curve !== col.anotherCurve.curve)
                    continue;

                // Skip crossings with vertical clearance (different elevations)
                if (
                    intersectionSatisfiesVerticalClearance(
                        col.selfT,
                        segment,
                        col.anotherCurve.tVal,
                        otherSeg
                    )
                )
                    continue;

                crossingMap.addCrossing(
                    curveNumber,
                    col.selfT,
                    otherNum,
                    col.anotherCurve.tVal
                );
                break;
            }
        }
    }

    // Populate from existing segments
    for (const segNum of trackCurveManager.livingEntities) {
        const seg = trackCurveManager.getTrackSegmentWithJoints(segNum);
        if (seg) addSegmentCrossings(segNum, seg);
    }

    // Subscribe to track mutations
    trackCurveManager.onAddTrackSegment((curveNumber, segment) => {
        addSegmentCrossings(curveNumber, segment);
    });

    trackCurveManager.onRemoveTrackSegment(curveNumber => {
        crossingMap.removeSegment(curveNumber);
    });

    // When a train is removed from the track, return its formation to the depot
    // and purge its cars from the cargo store.
    trainManager.setOnBeforeRemove(train => {
        formationManager.addFormation(train.formation);
        for (const car of train.cars) {
            carCargoStore.destroyCar(car.id);
        }
    });

    // When a car is permanently removed from stock (deleted from the depot),
    // purge its cargo store entry to prevent a slow memory leak.
    carStockManager.setOnBeforeRemove(car => {
        carCargoStore.destroyCar(car.id);
    });

    const kmtInputStateMachine = createKmtInputStateMachineExpansion(
        layoutSubStateMachine,
        trainStateMachine,
        stationStateMachine,
        duplicateSubStateMachine,
        catenarySubStateMachine,
        singleSpineStateMachine,
        dualSpineStateMachine,
        jointDirectionSubStateMachine,
        baseComponents.observableInputTracker
    );
    baseComponents.kmtParser.stateMachine = kmtInputStateMachine;
    baseComponents.kmtInputStateMachine = kmtInputStateMachine;

    trackGraph.onSegmentSplit(info => {
        for (const { train } of trainManager.getPlacedTrains()) {
            train.remapOnSegmentSplit(info);
        }
        trainPlacementEngine.train.remapOnSegmentSplit(info);
        blockSignalManager.handleSegmentSplit(info);
    });

    trackGraph.onSegmentRemoved(segNum => {
        blockSignalManager.handleSegmentRemoved(segNum);
    });

    baseComponents.app.stage.addChild(worldRenderSystem.container);

    const unsubTimeManager = timeManager.subscribe(
        (currentTime: number, deltaTime: number) => {
            // Timetable auto-drivers set throttle before physics update
            timetableRef.current.update(currentTime, deltaTime);
            trainRenderSystem.update(deltaTime);
            // Run auto-coupler after physics + detectors + collision-guard.
            // Order matters: detector and collision-guard run inside
            // trainRenderSystem.update(); auto-coupler must run after both
            // so it never tries to couple a pair that collision-guard just
            // emergency-stopped this frame (the result would be 'invalid'
            // and we'd burn cycles every frame until the trains separate).
            autoCoupler.update();
            // Recompute signal aspects from fresh occupancy, then update visuals
            signalStateEngine.update(
                trainRenderSystem.occupancyRegistry,
                trainManager.getPlacedTrains()
            );
            signalRenderSystem.update();
            debugOverlayRenderSystem.updateFormationLabels();
            debugOverlayRenderSystem.updateProximityLines();
        }
    );

    const unsubTrainChanges = trainManager.subscribeToChanges(() => {
        trainRenderSystem.forceSync();
    });

    baseComponents.cleanups.push(() => {
        unsubTimeManager();
        unsubTrainChanges();
        timeManager.dispose();
        timetableRef.current.dispose();
        signalRenderSystem.dispose();
    });

    const cameraMux = createCameraMuxWithAnimationAndLock();
    baseComponents.inputOrchestrator.cameraMux = cameraMux;

    const addTrainAtPosition = (
        segmentNumber: number,
        tValue: number,
        direction: 'tangent' | 'reverseTangent'
    ): boolean => {
        const segment = trackGraph.getTrackSegmentWithJoints(segmentNumber);
        if (!segment) return false;
        const point = segment.curve.getPointbyPercentage(tValue);
        const position: TrainPosition = {
            trackSegment: segmentNumber,
            tValue,
            direction,
            point,
        };
        const train = new Train(position, trackGraph, jointDirectionManager);
        trainManager.addTrain(train);
        return true;
    };

    const addStressTestTrains = (count: number): number => {
        const segmentNumbers = trackGraph.trackCurveManager.livingEntities;
        if (segmentNumbers.length === 0) return 0;
        const segmentNumber = segmentNumbers[0];
        let added = 0;
        for (let i = 0; i < count; i++) {
            const t = 0.3 + (i / Math.max(count, 1)) * 0.4;
            if (addTrainAtPosition(segmentNumber, t, 'tangent')) added += 1;
        }
        return added;
    };

    const generateProceduralTracks = (
        options: ProceduralTrackOptions
    ): number => {
        return generateProceduralTrackPath(trackGraph, options);
    };

    const spawnParallelTracksWithTrains = (
        count: number,
        startX?: number,
        startY?: number
    ): number => {
        const opts: ParallelTrackOptions = { count, length: 500 };
        if (startX !== undefined) opts.startX = startX;
        if (startY !== undefined) opts.startY = startY;
        const segmentIds = generateParallelTracks(trackGraph, opts);
        let placed = 0;
        for (const segId of segmentIds) {
            if (addTrainAtPosition(segId, 0.5, 'tangent')) placed += 1;
        }
        trainRenderSystem.forceSync();
        return placed;
    };

    return {
        ...baseComponents,
        curveEngine,
        trackGraph,
        duplicateToSideEngine,
        catenaryLayoutEngine,
        worldRenderSystem,
        terrainData,
        terrainRenderSystem,
        trackRenderSystem,
        trainRenderSystem,
        buildingManager,
        buildingRenderSystem,
        trainPlacementEngine,
        trainManager,
        carStockManager,
        formationManager,
        jointDirectionManager,
        jointDirectionPreferenceMap,
        jointDirectionRenderSystem,
        cameraMux,
        startFocusAnimation,
        startFollowAnimation,
        stopFollowing,
        isFollowing,
        layoutStateMachine: layoutSubStateMachine,
        kmtStateMachineExpansion: kmtInputStateMachine,
        trainStateMachine,
        debugOverlayRenderSystem,
        carImageRegistry,
        carTemplateStore,
        formationTemplateStore,
        timeManager,
        scheduleClock,
        timetableManager,
        timetableRef,
        stationManager,
        stationRenderSystem,
        trackAlignedPlatformManager,
        trackAlignedPlatformRenderSystem,
        blockSignalManager,
        signalStateEngine,
        signalRenderSystem,
        stationPresenceDetector,
        carCargoStore,
        platformBufferStore,
        transferManager,
        sourceSinkTicker,
        statsDom: stats.dom,
        addTrainAtPosition,
        addStressTestTrains,
        generateProceduralTracks,
        spawnParallelTracksWithTrains,
        animations,
    };

    // Expose app components on window for console debugging
    if (typeof window !== 'undefined') {
        (window as unknown as Record<string, unknown>).__banana = result;
    }

    return result;
};
