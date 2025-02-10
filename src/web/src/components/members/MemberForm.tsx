import React, { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form'; // ^7.45.0
import { z } from 'zod'; // ^3.22.0
import { zodResolver } from '@hookform/resolvers/zod'; // ^3.22.0
import { Input } from '../common/Input';
import { useToast } from '../../hooks/useToast';
import type { Member, SocialProfile, CreateMemberInput, UpdateMemberInput } from '../../types/members';

// Form validation schema following security and data quality requirements
const socialProfileSchema = z.object({
  platform: z.enum(['LINKEDIN', 'GMAIL'], {
    errorMap: () => ({ message: 'Unsupported social platform' })
  }),
  externalId: z.string()
    .min(1, 'External ID is required')
    .max(100, 'External ID cannot exceed 100 characters'),
  verified: z.boolean(),
  lastSynced: z.date()
});

const formSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters, spaces, hyphens and apostrophes'),
  email: z.string()
    .email('Invalid email format')
    .regex(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Email must be in a valid format'
    ),
  location: z.string()
    .max(200, 'Location cannot exceed 200 characters')
    .optional(),
  role: z.enum(['ADMIN', 'MEMBER', 'ANALYST'], {
    errorMap: () => ({ message: 'Invalid role selection' })
  }),
  socialProfiles: z.array(socialProfileSchema)
});

type FormSchema = z.infer<typeof formSchema>;

interface MemberFormProps {
  member?: Member;
  onSubmit: (data: CreateMemberInput | UpdateMemberInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export const MemberForm: React.FC<MemberFormProps> = ({
  member,
  onSubmit,
  onCancel,
  isSubmitting
}) => {
  const { showToast } = useToast();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setValue,
    watch
  } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: member ? {
      name: member.profile.name,
      email: member.profile.email,
      location: member.profile.location,
      role: member.profile.role,
      socialProfiles: member.socialProfiles
    } : {
      name: '',
      email: '',
      location: '',
      role: 'MEMBER',
      socialProfiles: []
    }
  });

  // Reset form when member prop changes
  useEffect(() => {
    if (member) {
      reset({
        name: member.profile.name,
        email: member.profile.email,
        location: member.profile.location,
        role: member.profile.role,
        socialProfiles: member.socialProfiles
      });
    }
  }, [member, reset]);

  // Handle social profile changes with platform-specific validation
  const handleSocialProfileChange = useCallback((
    platform: 'LINKEDIN' | 'GMAIL',
    profile: Partial<SocialProfile>
  ) => {
    const currentProfiles = watch('socialProfiles');
    const profileIndex = currentProfiles.findIndex(p => p.platform === platform);

    if (profileIndex >= 0) {
      const updatedProfiles = [...currentProfiles];
      updatedProfiles[profileIndex] = {
        ...updatedProfiles[profileIndex],
        ...profile
      };
      setValue('socialProfiles', updatedProfiles, { shouldValidate: true });
    } else {
      setValue('socialProfiles', [
        ...currentProfiles,
        {
          platform,
          externalId: profile.externalId || '',
          verified: false,
          lastSynced: new Date()
        }
      ], { shouldValidate: true });
    }
  }, [setValue, watch]);

  // Form submission handler with validation and error handling
  const onFormSubmit = useCallback(async (data: FormSchema) => {
    try {
      const formattedData = {
        profile: {
          name: data.name,
          email: data.email,
          location: data.location,
          role: data.role
        },
        socialProfiles: data.socialProfiles
      };

      await onSubmit(formattedData);
      showToast({
        type: 'success',
        message: `Member ${member ? 'updated' : 'created'} successfully`
      });
      if (!member) {
        reset();
      }
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to save member profile',
        description: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
    }
  }, [member, onSubmit, reset, showToast]);

  return (
    <form 
      onSubmit={handleSubmit(onFormSubmit)}
      className="space-y-6"
      aria-label="Member profile form"
    >
      <Input
        label="Full Name"
        error={errors.name?.message}
        {...register('name')}
        aria-label="Full name"
        aria-describedby={errors.name ? 'name-error' : undefined}
        required
      />

      <Input
        label="Email Address"
        type="email"
        error={errors.email?.message}
        {...register('email')}
        aria-label="Email address"
        aria-describedby={errors.email ? 'email-error' : undefined}
        required
      />

      <Input
        label="Location"
        error={errors.location?.message}
        {...register('location')}
        aria-label="Location"
        aria-describedby={errors.location ? 'location-error' : undefined}
      />

      <div className="space-y-2">
        <label 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          htmlFor="role"
        >
          Role
        </label>
        <select
          id="role"
          className="w-full px-3 py-2 border rounded-md"
          {...register('role')}
          aria-label="Member role"
          aria-describedby={errors.role ? 'role-error' : undefined}
          required
        >
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
          <option value="ANALYST">Analyst</option>
        </select>
        {errors.role && (
          <p id="role-error" className="text-sm text-red-500" role="alert">
            {errors.role.message}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Social Profiles</h3>
        
        {['LINKEDIN', 'GMAIL'].map((platform) => (
          <div key={platform} className="space-y-2">
            <Input
              label={`${platform} Profile ID`}
              value={watch('socialProfiles')?.find(p => p.platform === platform)?.externalId || ''}
              onChange={(value) => handleSocialProfileChange(platform as 'LINKEDIN' | 'GMAIL', { 
                externalId: value as string 
              })}
              error={errors.socialProfiles?.find(p => p?.platform === platform)?.externalId?.message}
              aria-label={`${platform} profile ID`}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          disabled={isSubmitting || !isDirty}
        >
          {isSubmitting ? 'Saving...' : member ? 'Update Member' : 'Create Member'}
        </button>
      </div>
    </form>
  );
};

export default MemberForm;