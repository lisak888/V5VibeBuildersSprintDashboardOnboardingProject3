
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Clock, Calendar, Play, CheckCircle, AlertCircle, Users } from 'lucide-react';

interface Sprint {
  id: string;
  startDate: string;
  endDate: string;
  type: 'build' | 'test' | 'pto' | null;
  description: string | null;
  status: 'historic' | 'current' | 'future';
}

interface DashboardStats {
  buildCount: number;
  testCount: number;
  ptoCount: number;
  uncommittedCount: number;
  isValid: boolean;
  daysRemaining: number;
}

interface DashboardData {
  user: { id: string; username: string };
  sprints: {
    historic: Sprint[];
    current: Sprint | null;
    future: Sprint[];
  };
  stats: DashboardStats;
}

interface CommitmentData {
  sprintId: string;
  type: 'build' | 'test' | 'pto' | null;
  description?: string;
}

export default function Dashboard() {
  const [commitments, setCommitments] = useState<Map<string, CommitmentData>>(new Map());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch dashboard data
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/current-user');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return response.json();
    },
  });

  // Save commitments mutation
  const saveCommitmentsMutation = useMutation({
    mutationFn: async (commitmentData: CommitmentData[]) => {
      const response = await fetch('/api/dashboard/current-user/commitments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commitments: commitmentData }),
      });
      if (!response.ok) {
        throw new Error('Failed to save commitments');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCommitments(new Map());
      setValidationErrors([]);
    },
    onError: (error: any) => {
      console.error('Failed to save commitments:', error);
    },
  });

  // Initialize commitments from data
  React.useEffect(() => {
    if (data && commitments.size === 0) {
      const initialCommitments = new Map<string, CommitmentData>();
      data.sprints.future.forEach(sprint => {
        initialCommitments.set(sprint.id, {
          sprintId: sprint.id,
          type: sprint.type,
          description: sprint.description || undefined,
        });
      });
      setCommitments(initialCommitments);
    }
  }, [data]);

  // Handle commitment changes
  const handleCommitmentChange = (sprintId: string, field: 'type' | 'description', value: string) => {
    setCommitments(prev => {
      const newCommitments = new Map(prev);
      const existing = newCommitments.get(sprintId) || { sprintId, type: null };
      
      if (field === 'type') {
        existing.type = value as 'build' | 'test' | 'pto' | null;
        // Clear description if not a build sprint
        if (value !== 'build') {
          existing.description = undefined;
        }
      } else if (field === 'description') {
        existing.description = value || undefined;
      }
      
      newCommitments.set(sprintId, existing);
      
      // Validate in real-time
      validateCommitments(newCommitments);
      
      return newCommitments;
    });
  };

  // Validate commitment rules
  const validateCommitments = (currentCommitments: Map<string, CommitmentData>) => {
    const errors: string[] = [];
    const values = Array.from(currentCommitments.values());
    const buildCount = values.filter(c => c.type === 'build').length;
    const ptoCount = values.filter(c => c.type === 'pto').length;
    
    if (ptoCount > 2) {
      errors.push('Maximum 2 PTO sprints allowed per 6-sprint window');
    }
    if (buildCount < 2) {
      errors.push('Minimum 2 Build sprints required per 6-sprint window');
    }
    
    // Check for Build sprints without descriptions
    const buildWithoutDescription = values.filter(c => 
      c.type === 'build' && (!c.description || c.description.trim() === '')
    );
    if (buildWithoutDescription.length > 0) {
      errors.push('All Build sprints require a description');
    }
    
    setValidationErrors(errors);
  };

  // Save commitments
  const handleSaveCommitments = () => {
    const commitmentData = Array.from(commitments.values()).filter(c => c.type !== null);
    saveCommitmentsMutation.mutate(commitmentData);
  };

  // Utility functions
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
  };

  const getSprintTypeColor = (type: Sprint['type']) => {
    switch (type) {
      case 'build': return 'bg-blue-500';
      case 'test': return 'bg-green-500';
      case 'pto': return 'bg-amber-500';
      default: return 'bg-gray-400';
    }
  };

  const getSprintTypeLabel = (type: Sprint['type']) => {
    if (!type) return 'Uncommitted';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your sprint dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Error Loading Dashboard</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Unable to load your sprint data. Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasUnsavedChanges = Array.from(commitments.values()).some(commitment => {
    const originalSprint = data.sprints.future.find(s => s.id === commitment.sprintId);
    return originalSprint && (
      originalSprint.type !== commitment.type ||
      originalSprint.description !== (commitment.description || null)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sprint Dashboard</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Welcome back, {data.user.username}! Manage your sprint commitments below.
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="text-sm">
                  <Users className="h-4 w-4 mr-1" />
                  Vibe Builders Collective
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Build Sprints</p>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.buildCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Test Sprints</p>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.testCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">PTO Sprints</p>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.ptoCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-gray-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Days Left</p>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.daysRemaining}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Sprint Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Historic Sprints */}
          <div className="lg:col-span-1">
            <Card className="border border-gray-200">
              <CardHeader className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="text-gray-500 h-5 w-5" />
                  <CardTitle className="text-lg font-semibold text-gray-900">Historic Sprints</CardTitle>
                </div>
                <p className="text-sm text-gray-600 mt-1">Completed sprint commitments</p>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="space-y-4">
                  {data.sprints.historic.length > 0 ? (
                    data.sprints.historic.slice(0, 5).map((sprint) => (
                      <div key={sprint.id} className={`border-l-4 rounded-r-lg p-3 ${
                        sprint.type === 'build' ? 'border-blue-500 bg-blue-50' :
                        sprint.type === 'test' ? 'border-green-500 bg-green-50' :
                        sprint.type === 'pto' ? 'border-amber-500 bg-amber-50' :
                        'border-gray-500 bg-gray-50'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${getSprintTypeColor(sprint.type)}`}></div>
                            <span className="font-medium text-sm">{getSprintTypeLabel(sprint.type)}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDateRange(sprint.startDate, sprint.endDate)}
                          </span>
                        </div>
                        {sprint.description && (
                          <p className="text-sm text-gray-700 mt-2">{sprint.description}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm italic">No historic sprints yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Sprint */}
          <div className="lg:col-span-1">
            <Card className="border border-gray-200">
              <CardHeader className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <Play className="text-green-500 h-5 w-5" />
                  <CardTitle className="text-lg font-semibold text-gray-900">Current Sprint</CardTitle>
                </div>
                <p className="text-sm text-gray-600 mt-1">Active sprint commitment</p>
              </CardHeader>
              
              <CardContent className="p-6">
                {data.sprints.current ? (
                  <div className={`border-l-4 rounded-r-lg p-4 ${
                    data.sprints.current.type === 'build' ? 'border-blue-500 bg-blue-50' :
                    data.sprints.current.type === 'test' ? 'border-green-500 bg-green-50' :
                    data.sprints.current.type === 'pto' ? 'border-amber-500 bg-amber-50' :
                    'border-gray-500 bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full ${getSprintTypeColor(data.sprints.current.type)}`}></div>
                        <span className="font-semibold text-lg">{getSprintTypeLabel(data.sprints.current.type)}</span>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {formatDateRange(data.sprints.current.startDate, data.sprints.current.endDate)}
                    </p>
                    {data.sprints.current.description && (
                      <p className="text-sm text-gray-700">{data.sprints.current.description}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">No current sprint</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Future Sprints */}
          <div className="lg:col-span-1">
            <Card className="border border-gray-200">
              <CardHeader className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="text-blue-500 h-5 w-5" />
                    <CardTitle className="text-lg font-semibold text-gray-900">Future Sprints</CardTitle>
                  </div>
                  {hasUnsavedChanges && (
                    <Button 
                      onClick={handleSaveCommitments}
                      disabled={validationErrors.length > 0 || saveCommitmentsMutation.isPending}
                      size="sm"
                      className="ml-2"
                    >
                      {saveCommitmentsMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">Plan your upcoming sprint commitments</p>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="space-y-6">
                  {data.sprints.future.map((sprint, index) => {
                    const commitment = commitments.get(sprint.id);
                    const currentType = commitment?.type || sprint.type;
                    const currentDescription = commitment?.description || sprint.description || '';

                    return (
                      <div key={sprint.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            Sprint {formatDateRange(sprint.startDate, sprint.endDate)}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {index === 0 ? 'Next' : `+${(index + 1) * 2} weeks`}
                          </Badge>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Sprint Type</label>
                            <Select
                              value={currentType || ''}
                              onValueChange={(value) => handleCommitmentChange(sprint.id, 'type', value)}
                            >
                              <SelectTrigger className="mt-1 w-full">
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="build">Build</SelectItem>
                                <SelectItem value="test">Test</SelectItem>
                                <SelectItem value="pto">PTO</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className={currentType === 'build' ? '' : 'opacity-50'}>
                            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Description</label>
                            <Textarea
                              className="mt-1 w-full resize-none"
                              rows={2}
                              placeholder={currentType === 'build' ? "Enter description for Build sprints..." : 
                                          currentType === 'test' ? "Test sprints don't require descriptions" :
                                          currentType === 'pto' ? "PTO sprints don't require descriptions" :
                                          "Enter description for Build sprints..."}
                              disabled={currentType !== 'build'}
                              value={currentDescription}
                              onChange={(e) => handleCommitmentChange(sprint.id, 'description', e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {currentType === 'build' ? "Description required for Build sprints" :
                               currentType === 'test' ? "No description needed for Test sprints" :
                               currentType === 'pto' ? "No description needed for PTO sprints" :
                               "Description only required for Build sprints"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasUnsavedChanges && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">You have unsaved changes</p>
                      <Button 
                        onClick={handleSaveCommitments}
                        disabled={validationErrors.length > 0 || saveCommitmentsMutation.isPending}
                        size="sm"
                      >
                        {saveCommitmentsMutation.isPending ? 'Saving...' : 'Save All Changes'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
