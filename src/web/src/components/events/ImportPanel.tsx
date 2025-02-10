import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';
import { useEvents } from '../../hooks/useEvents';
import { useToast } from '../../hooks/useToast';
import { EventPlatform, ImportEventsInput } from '../../types/events';

// Maximum file size for CSV imports (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Supported file types
const SUPPORTED_FILE_TYPES = ['text/csv', 'application/csv'];

// Platform connection states interface
interface PlatformConnections {
  [EventPlatform.LUMA]: boolean;
  [EventPlatform.EVENTBRITE]: boolean;
  [EventPlatform.PARTIFUL]: boolean;
}

// Recent import interface
interface RecentImport {
  id: string;
  platform: EventPlatform | 'CSV';
  status: 'success' | 'processing' | 'failed';
  timestamp: Date;
  eventCount?: number;
  error?: string;
}

export const ImportPanel: React.FC = () => {
  // State management
  const [isImporting, setIsImporting] = useState(false);
  const [platformConnections, setPlatformConnections] = useState<PlatformConnections>({
    [EventPlatform.LUMA]: false,
    [EventPlatform.EVENTBRITE]: false,
    [EventPlatform.PARTIFUL]: false,
  });
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { importEvents } = useEvents();
  const toast = useToast();

  // Platform connection handler
  const handlePlatformConnect = useCallback(async (platform: EventPlatform) => {
    try {
      // Initiate platform connection flow
      const response = await fetch(`/api/events/connect/${platform.toLowerCase()}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to connect to ${platform}`);
      }

      setPlatformConnections(prev => ({
        ...prev,
        [platform]: true,
      }));

      toast.showToast({
        type: 'success',
        message: `Successfully connected to ${platform}`,
      });
    } catch (error) {
      toast.showToast({
        type: 'error',
        message: `Failed to connect to ${platform}`,
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }, [toast]);

  // File upload handler
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.showToast({
        type: 'error',
        message: 'File too large',
        description: 'Maximum file size is 10MB',
      });
      return;
    }

    // Validate file type
    if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
      toast.showToast({
        type: 'error',
        message: 'Invalid file type',
        description: 'Please upload a CSV file',
      });
      return;
    }

    try {
      setIsImporting(true);
      const formData = new FormData();
      formData.append('file', file);

      const importId = `csv-${Date.now()}`;
      setRecentImports(prev => [{
        id: importId,
        platform: 'CSV',
        status: 'processing',
        timestamp: new Date(),
      }, ...prev.slice(0, 9)]);

      await importEvents({
        platform: EventPlatform.LUMA, // CSV imports are processed as LUMA events
        file: formData,
      });

      setRecentImports(prev => 
        prev.map(imp => 
          imp.id === importId 
            ? { ...imp, status: 'success' }
            : imp
        )
      );

      toast.showToast({
        type: 'success',
        message: 'Events imported successfully',
      });
    } catch (error) {
      toast.showToast({
        type: 'error',
        message: 'Failed to import events',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [importEvents, toast]);

  // Platform import handler
  const handlePlatformImport = useCallback(async (platform: EventPlatform) => {
    if (!platformConnections[platform]) {
      toast.showToast({
        type: 'error',
        message: 'Platform not connected',
        description: `Please connect to ${platform} before importing events`,
      });
      return;
    }

    try {
      setIsImporting(true);
      const importId = `${platform.toLowerCase()}-${Date.now()}`;
      
      setRecentImports(prev => [{
        id: importId,
        platform,
        status: 'processing',
        timestamp: new Date(),
      }, ...prev.slice(0, 9)]);

      await importEvents({
        platform,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate: new Date(),
      });

      setRecentImports(prev => 
        prev.map(imp => 
          imp.id === importId 
            ? { ...imp, status: 'success' }
            : imp
        )
      );

      toast.showToast({
        type: 'success',
        message: `Successfully imported events from ${platform}`,
      });
    } catch (error) {
      toast.showToast({
        type: 'error',
        message: `Failed to import events from ${platform}`,
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsImporting(false);
    }
  }, [importEvents, platformConnections, toast]);

  return (
    <div className="space-y-6">
      {/* Platform Connections Section */}
      <Card variant="outlined" padding="md">
        <h2 className="text-xl font-semibold mb-4">Import Sources</h2>
        <div className="space-y-4">
          {Object.values(EventPlatform).map(platform => (
            <div key={platform} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Icon 
                  name="import"
                  size="md"
                  ariaLabel={`${platform} icon`}
                />
                <span>{platform}</span>
              </div>
              <Button
                variant={platformConnections[platform] ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => platformConnections[platform] 
                  ? handlePlatformImport(platform)
                  : handlePlatformConnect(platform)
                }
                disabled={isImporting}
                startIcon={platformConnections[platform] ? 'import' : 'add'}
              >
                {platformConnections[platform] ? 'Import Events' : 'Connect'}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* CSV Import Section */}
      <Card variant="outlined" padding="md">
        <h2 className="text-xl font-semibold mb-4">Manual Import</h2>
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && fileInputRef.current) {
              fileInputRef.current.files = e.dataTransfer.files;
              handleFileUpload({ target: fileInputRef.current } as any);
            }
          }}
        >
          <Icon
            name="import"
            size="lg"
            ariaLabel="Upload icon"
            className="mb-4"
          />
          <p className="mb-2">Drag and drop CSV file or click to upload</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            aria-label="Upload CSV file"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            startIcon="import"
          >
            Select File
          </Button>
        </div>
      </Card>

      {/* Recent Imports Section */}
      <Card variant="outlined" padding="md">
        <h2 className="text-xl font-semibold mb-4">Recent Imports</h2>
        <AnimatePresence>
          {recentImports.map((importItem) => (
            <motion.div
              key={importItem.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center justify-between py-2 border-b last:border-b-0"
            >
              <div className="flex items-center space-x-3">
                <Icon
                  name={importItem.status === 'success' ? 'add' : 
                        importItem.status === 'processing' ? 'settings' : 'close'}
                  size="sm"
                  ariaLabel={`Status: ${importItem.status}`}
                  className={importItem.status === 'processing' ? 'animate-spin' : ''}
                />
                <span>{importItem.platform}</span>
                <span className="text-sm text-gray-500">
                  {new Date(importItem.timestamp).toLocaleString()}
                </span>
              </div>
              <span className={`text-sm ${
                importItem.status === 'success' ? 'text-green-600' :
                importItem.status === 'failed' ? 'text-red-600' :
                'text-blue-600'
              }`}>
                {importItem.status.charAt(0).toUpperCase() + importItem.status.slice(1)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </Card>
    </div>
  );
};

export default ImportPanel;