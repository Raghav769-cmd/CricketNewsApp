import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@repo/ui/toast';
import { FormError, FormField } from './FormComponents';
import './datetime-picker.css';

// Validation schema
const addMatchSchema = z.object({
  team1: z.string().min(1, 'Team 1 is required'),
  team2: z.string().min(1, 'Team 2 is required'),
  date: z.string().min(1, 'Date is required'),
  venue: z.string().min(3, 'Venue must be at least 3 characters').max(100, 'Venue must be at most 100 characters'),
  score: z.string(),
  overs_per_inning: z.string().min(1, 'Overs per inning is required'),
}).refine((data) => data.team1 !== data.team2, {
  message: 'Team 1 and Team 2 must be different',
  path: ['team2'],
});

type AddMatchFormData = z.infer<typeof addMatchSchema>;

interface AddMatchFormProps {
  teams: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSubmit: (data: AddMatchFormData) => Promise<void>;
  isSubmitting: boolean;
}

export const AddMatchForm: React.FC<AddMatchFormProps> = ({
  teams,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<AddMatchFormData>({
    resolver: zodResolver(addMatchSchema),
    defaultValues: {
      team1: '',
      team2: '',
      date: '',
      venue: '',
      score: '0-0',
      overs_per_inning: '20',
    },
  });

  const team1Value = watch('team1');
  const team2Value = watch('team2');

  const handleFormSubmit = async (data: AddMatchFormData) => {
    try {
      await onSubmit(data);
      reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-700/50 animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Add New Match
            </h2>
            <p className="text-sm text-gray-400">
              Create a new cricket match
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 hover:bg-slate-700 rounded-lg p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
          {/* Team 1 */}
          <FormField label="Team 1" required error={errors.team1?.message}>
            <select
              {...register('team1')}
              className={`w-full px-4 py-3 border rounded-lg bg-slate-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200 ${
                errors.team1 ? 'border-red-500' : 'border-slate-700'
              }`}
            >
              <option value="">Select Team 1</option>
              {teams
                .filter((team) => String(team.id) !== team2Value)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
            </select>
          </FormField>

          {/* Team 2 */}
          <FormField label="Team 2" required error={errors.team2?.message}>
            <select
              {...register('team2')}
              className={`w-full px-4 py-3 border rounded-lg bg-slate-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200 ${
                errors.team2 ? 'border-red-500' : 'border-slate-700'
              }`}
            >
              <option value="">Select Team 2</option>
              {teams
                .filter((team) => String(team.id) !== team1Value)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
            </select>
          </FormField>

          {/* Date */}
          <FormField label="Date & Time" required error={errors.date?.message}>
            <input
              type="datetime-local"
              {...register('date')}
              className={`w-full px-4 py-3 border rounded-lg bg-slate-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200 ${
                errors.date ? 'border-red-500' : 'border-slate-700 hover:border-slate-600'
              }`}
              style={{
                colorScheme: 'dark',
              }}
            />
          </FormField>

          {/* Venue */}
          <FormField label="Venue" required error={errors.venue?.message}>
            <input
              type="text"
              placeholder="e.g., Lord's Cricket Ground"
              {...register('venue')}
              className={`w-full px-4 py-3 border rounded-lg bg-slate-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200 ${
                errors.venue ? 'border-red-500' : 'border-slate-700'
              }`}
            />
          </FormField>

          {/* Two Column Layout: Initial Score & Overs Per Inning */}
          <div className="grid grid-cols-2 gap-4">
            {/* Initial Score */}
            <FormField 
              label="Initial Score" 
              helperText="Optional"
            >
              <input
                type="text"
                placeholder="e.g., 0-0"
                {...register('score')}
                className="w-full px-4 py-3 border border-slate-700 rounded-lg bg-slate-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200"
              />
            </FormField>

            {/* Overs Per Inning */}
            <FormField label="Overs Per Inning" required error={errors.overs_per_inning?.message}>
              <select
                {...register('overs_per_inning')}
                className={`w-full px-4 py-3 border rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200 ${
                  errors.overs_per_inning ? 'border-red-500' : 'border-slate-700'
                }`}
              >
                <option value="1">1 Over (Testing)</option>
                <option value="5">5 Overs</option>
                <option value="10">10 Overs</option>
                <option value="20">20 Overs (T20)</option>
                <option value="50">50 Overs (ODI)</option>
              </select>
            </FormField>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 border-2 border-slate-700 text-gray-300 rounded-lg font-semibold hover:bg-slate-800/50 hover:border-slate-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-linear-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 disabled:from-lime-500/50 disabled:to-lime-600/50 text-black rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Match</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
