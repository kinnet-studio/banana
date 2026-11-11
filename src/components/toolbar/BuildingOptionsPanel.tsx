import { useTranslation } from 'react-i18next';

import type { BuildingPreset } from '@/buildings/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type BuildingOptionsPanelProps = {
    preset: BuildingPreset;
    onPresetChange: (preset: BuildingPreset) => void;
    /** Height of the building's base, in metres. */
    elevation: number;
    onElevationChange: (elevation: number) => void;
    /** Height above the base, in metres. */
    height: number;
    onHeightChange: (height: number) => void;
};

export function BuildingOptionsPanel({
    preset,
    onPresetChange,
    elevation,
    onElevationChange,
    height,
    onHeightChange,
}: BuildingOptionsPanelProps) {
    const { t } = useTranslation();
    return (
        <div className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2">
            <div className="bg-background/80 flex flex-col gap-2 rounded-xl border p-3 shadow-lg backdrop-blur-sm">
                <span className="text-muted-foreground text-xs font-medium">
                    {t('building')}
                </span>
                <Select
                    value={preset}
                    onValueChange={val => onPresetChange(val as BuildingPreset)}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="small">{t('small')}</SelectItem>
                        <SelectItem value="medium">{t('medium')}</SelectItem>
                        <SelectItem value="large">{t('large')}</SelectItem>
                        <SelectItem value="l-shape">{t('lShape')}</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={String(elevation)}
                    onValueChange={val => onElevationChange(Number(val))}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0">{t('ground')}</SelectItem>
                        <SelectItem value="10">{t('above1')}</SelectItem>
                        <SelectItem value="20">{t('above2')}</SelectItem>
                        <SelectItem value="30">{t('above3')}</SelectItem>
                    </SelectContent>
                </Select>
                <label className="flex flex-col gap-1 text-xs">
                    {t('height')}: {height} m
                    <input
                        type="range"
                        min={5}
                        max={50}
                        step={5}
                        value={height}
                        onChange={e => onHeightChange(Number(e.target.value))}
                        className="w-full"
                    />
                </label>
            </div>
        </div>
    );
}
