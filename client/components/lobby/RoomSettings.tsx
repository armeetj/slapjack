'use client';

import { RoomSettings as RoomSettingsType } from '@/types/game';

interface RoomSettingsProps {
  settings: RoomSettingsType;
  onChange: (settings: Partial<RoomSettingsType>) => void;
  disabled?: boolean;
}

export function RoomSettings({
  settings,
  onChange,
  disabled = false,
}: RoomSettingsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Game Settings</h3>

      {/* Max Players */}
      <div>
        <label className="flex justify-between items-center text-sm text-gray-300 mb-2">
          <span>Max Players</span>
          <span className="text-white font-medium">{settings.maxPlayers}</span>
        </label>
        <input
          type="range"
          min={2}
          max={8}
          value={settings.maxPlayers}
          onChange={(e) =>
            onChange({ maxPlayers: parseInt(e.target.value) })
          }
          disabled={disabled}
          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-yellow-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>2</span>
          <span>8</span>
        </div>
      </div>

      {/* Turn Timeout */}
      <div>
        <label className="flex justify-between items-center text-sm text-gray-300 mb-2">
          <span>Turn Timeout</span>
          <span className="text-white font-medium">
            {settings.turnTimeoutMs / 1000}s
          </span>
        </label>
        <input
          type="range"
          min={5000}
          max={30000}
          step={1000}
          value={settings.turnTimeoutMs}
          onChange={(e) =>
            onChange({ turnTimeoutMs: parseInt(e.target.value) })
          }
          disabled={disabled}
          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-yellow-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>5s</span>
          <span>30s</span>
        </div>
      </div>

      {/* Slap Rules */}
      <div className="space-y-3">
        <label className="text-sm text-gray-300">Slap Rules</label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enableDoubles}
            onChange={(e) => onChange({ enableDoubles: e.target.checked })}
            disabled={disabled}
            className="w-5 h-5 rounded bg-white/20 border-white/30 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0"
          />
          <div>
            <span className="text-white">Doubles</span>
            <p className="text-xs text-gray-400">
              Slap on two cards of the same rank
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enableSandwich}
            onChange={(e) => onChange({ enableSandwich: e.target.checked })}
            disabled={disabled}
            className="w-5 h-5 rounded bg-white/20 border-white/30 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0"
          />
          <div>
            <span className="text-white">Sandwich</span>
            <p className="text-xs text-gray-400">
              Slap when same rank cards sandwich another
            </p>
          </div>
        </label>
      </div>

      {/* Burn Penalty */}
      <div>
        <label className="flex justify-between items-center text-sm text-gray-300 mb-2">
          <span>Burn Penalty</span>
          <span className="text-white font-medium">
            {settings.burnPenalty} card{settings.burnPenalty !== 1 ? 's' : ''}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={3}
          value={settings.burnPenalty}
          onChange={(e) =>
            onChange({ burnPenalty: parseInt(e.target.value) })
          }
          disabled={disabled}
          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-yellow-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0</span>
          <span>3</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Cards lost on invalid slap
        </p>
      </div>

      {/* Slap Back In */}
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enableSlapIn}
            onChange={(e) => onChange({ enableSlapIn: e.target.checked })}
            disabled={disabled}
            className="w-5 h-5 rounded bg-white/20 border-white/30 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0"
          />
          <div>
            <span className="text-white">Slap Back In</span>
            <p className="text-xs text-gray-400">
              Players with 0 cards can slap back in
            </p>
          </div>
        </label>

        {/* Max Slap-Ins (only visible when slap-in is enabled) */}
        {settings.enableSlapIn && (
          <div className="ml-8">
            <label className="flex justify-between items-center text-sm text-gray-300 mb-2">
              <span>Max Slap-Ins</span>
              <span className="text-white font-medium">{settings.maxSlapIns}x</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={settings.maxSlapIns}
              onChange={(e) => onChange({ maxSlapIns: parseInt(e.target.value) })}
              disabled={disabled}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>5</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
