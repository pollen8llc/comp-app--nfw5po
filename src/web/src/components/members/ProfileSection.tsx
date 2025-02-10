import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import { z } from 'zod'; // v3.22.0
import { ErrorBoundary } from '@sentry/react'; // v7.0.0
import { useA11y } from '@react-aria/interactions'; // v3.0.0

import { Member, profileSchema, SocialPlatform } from '../../types/members';
import { useMembers } from '../../hooks/useMembers';
import { useToast } from '../../hooks/useToast';
import { Icon, ICON_NAMES } from '../common/Icon';

// Animation variants for profile section
const profileAnimations = {
  container: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  field: {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.2 },
  },
};

interface ProfileSectionProps {
  member: Member;
  isEditing: boolean;
  onEditComplete: () => void;
}

// Enhanced validation schema with security measures
const secureProfileSchema = profileSchema.extend({
  email: z.string().email().transform((val) => val.toLowerCase().trim()),
  name: z.string().min(2).max(100).transform((val) => val.trim()),
  location: z.string().optional().transform((val) => val?.trim()),
});

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  member,
  isEditing,
  onEditComplete,
}) => {
  // State management
  const [formData, setFormData] = useState({
    name: member.profile.name,
    email: member.profile.email,
    location: member.profile.location || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Hooks
  const { updateMember } = useMembers();
  const { showToast } = useToast();
  const { pressProps, isPressed } = useA11y();

  // Form validation and submission
  const handleProfileUpdate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate form data
      const validatedData = await secureProfileSchema.parseAsync(formData);

      // Update member profile
      await updateMember({
        id: member.id,
        data: {
          profile: {
            ...member.profile,
            ...validatedData,
          },
        },
      });

      showToast({
        type: 'success',
        message: 'Profile updated successfully',
        role: 'status',
      });

      onEditComplete();
    } catch (error) {
      if (error instanceof z.ZodError) {
        showToast({
          type: 'error',
          message: 'Invalid profile data',
          description: error.errors[0].message,
          role: 'alert',
        });
      } else {
        showToast({
          type: 'error',
          message: 'Failed to update profile',
          role: 'alert',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, member, updateMember, showToast, onEditComplete]);

  // Social platform connection handler
  const handleSocialConnect = useCallback(async (platform: SocialPlatform) => {
    try {
      const isConnected = member.socialProfiles.some(
        (profile) => profile.platform === platform
      );

      if (isConnected) {
        showToast({
          type: 'info',
          message: `${platform} account already connected`,
          role: 'status',
        });
        return;
      }

      // Implement social connection logic here
      showToast({
        type: 'info',
        message: `Connecting to ${platform}...`,
        role: 'status',
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: `Failed to connect ${platform}`,
        role: 'alert',
      });
    }
  }, [member.socialProfiles, showToast]);

  return (
    <ErrorBoundary fallback={<div>Error loading profile section</div>}>
      <motion.section
        aria-label="Profile Information"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={profileAnimations.container}
        className="profile-section"
      >
        <form
          ref={formRef}
          onSubmit={handleProfileUpdate}
          className="profile-form"
          aria-busy={isSubmitting}
        >
          <div className="profile-header">
            <motion.div
              className="avatar-container"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <img
                src={member.profile.profileImageUrl || '/default-avatar.png'}
                alt={`${member.profile.name}'s avatar`}
                className="avatar"
                loading="lazy"
              />
              {isEditing && (
                <button
                  type="button"
                  className="avatar-edit-button"
                  aria-label="Change profile picture"
                  {...pressProps}
                >
                  <Icon
                    name={ICON_NAMES[3]}
                    size="sm"
                    ariaLabel="Edit"
                  />
                </button>
              )}
            </motion.div>

            <div className="profile-info">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="editing"
                    variants={profileAnimations.field}
                    className="form-fields"
                  >
                    <div className="form-field">
                      <label htmlFor="name">Name</label>
                      <input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          name: e.target.value
                        }))}
                        required
                        aria-required="true"
                        maxLength={100}
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="email">Email</label>
                      <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          email: e.target.value
                        }))}
                        required
                        aria-required="true"
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="location">Location</label>
                      <input
                        id="location"
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          location: e.target.value
                        }))}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="viewing"
                    variants={profileAnimations.field}
                    className="profile-details"
                  >
                    <h2>{member.profile.name}</h2>
                    <p>{member.profile.email}</p>
                    {member.profile.location && (
                      <p>{member.profile.location}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="social-profiles">
            <h3>Connected Accounts</h3>
            <div className="social-buttons">
              {Object.values(SocialPlatform).map((platform) => {
                const isConnected = member.socialProfiles.some(
                  (profile) => profile.platform === platform
                );

                return (
                  <motion.button
                    key={platform}
                    type="button"
                    onClick={() => handleSocialConnect(platform)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`social-button ${isConnected ? 'connected' : ''}`}
                    aria-label={`${isConnected ? 'Connected to' : 'Connect'} ${platform}`}
                    disabled={isSubmitting}
                  >
                    <Icon
                      name={ICON_NAMES[11]}
                      size="sm"
                      ariaLabel={platform}
                    />
                    {platform}
                    {isConnected && (
                      <Icon
                        name={ICON_NAMES[0]}
                        size="sm"
                        ariaLabel="Connected"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {isEditing && (
            <div className="form-actions">
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="save-button"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </motion.button>
              <motion.button
                type="button"
                onClick={onEditComplete}
                disabled={isSubmitting}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="cancel-button"
              >
                Cancel
              </motion.button>
            </div>
          )}
        </form>
      </motion.section>
    </ErrorBoundary>
  );
};

export default ProfileSection;