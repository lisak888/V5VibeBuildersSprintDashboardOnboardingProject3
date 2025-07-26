import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, CheckCircle, Clock, History, Rocket, User, Database, Webhook, RotateCcw, AlertCircle, Play } from "lucide-react";

interface Sprint {
  id: string;
  sprintNumber: number;
  startDate: string;
  endDate: string;
  type: "build" | "test" | "pto" | null;
  description: string | null;
  status: "historic" | "current" | "future";
}

interface DashboardData {
  user: { id: string; username: string };
  sprints: {
    historic: Sprint[];
    current: Sprint;
    future: Sprint[];
  };
  stats: {
    buildCount: number;
    testCount: number;
    ptoCount: number;
    uncommittedCount: number;
    isValid: boolean;
    daysRemaining: number;
  };
}

export default function Dashboard() {
  const params = useParams();
  const username = params.username || "demo-user";
  const queryClient = useQueryClient();
  
  const [commitments, setCommitments] = useState<Record<string, { type?: string; description?: string }>>({});

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard", username],
  });

  const updateCommitmentsMutation = useMutation({
    mutationFn: async (commitmentData: any) => {
      return apiRequest("POST", `/api/dashboard/${username}/commitments`, commitmentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", username] });
      toast({
        title: "Success",
        description: "Sprint commitments updated successfully",
      });
      setCommitments({});
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update commitments",
        variant: "destructive",
      });
    },
  });

  const completeDashboardMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/dashboard/${username}/complete`, {});
    },
    onSuccess: () => {
      toast({
        title: "Dashboard Completed",
        description: "Welcome webhook sent successfully",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-96 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900">Error Loading Dashboard</h1>
            </div>
            <p className="text-sm text-gray-600">
              Failed to load dashboard data. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCommitmentChange = (sprintId: string, field: string, value: string) => {
    setCommitments(prev => ({
      ...prev,
      [sprintId]: {
        ...prev[sprintId],
        [field]: value,
      },
    }));
  };

  const handleSaveCommitments = () => {
    const commitmentData = {
      commitments: Object.entries(commitments).map(([sprintId, commitment]) => ({
        sprintId,
        type: commitment.type || undefined,
        description: commitment.description || undefined,
      })).filter(c => c.type), // Only send commitments with a type
    };

    updateCommitmentsMutation.mutate(commitmentData);
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const end = new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${start} - ${end}`;
  };

  const getSprintTypeColor = (type: string | null) => {
    switch (type) {
      case "build": return "bg-blue-500";
      case "test": return "bg-green-500";
      case "pto": return "bg-amber-500";
      default: return "bg-gray-400";
    }
  };

  const getSprintTypeBadgeColor = (type: string | null) => {
    switch (type) {
      case "build": return "bg-blue-50 text-blue-600 border-blue-200";
      case "test": return "bg-green-50 text-green-600 border-green-200";
      case "pto": return "bg-amber-50 text-amber-600 border-amber-200";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Rocket className="text-white text-sm" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Vibe Builders Sprint Dashboard</h1>
                <p className="text-sm text-gray-500">Personal Sprint Commitment Tracker</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                <Calendar className="text-gray-400 h-4 w-4" />
                <span>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="text-gray-600 text-sm h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sprint Overview */}
        <div className="mb-8">
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Sprint Overview</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Clock className="text-gray-400 h-4 w-4" />
                  <span>Next transition: <span className="font-medium text-gray-900">Auto-managed</span></span>
                </div>
              </div>
              
              {/* Sprint Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">Build Sprints</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-gray-900">{data.stats.buildCount}</span>
                    <span className="text-sm text-gray-500">/ 2 min</span>
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">Test Sprints</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-gray-900">{data.stats.testCount}</span>
                    <span className="text-sm text-gray-500">no limits</span>
                  </div>
                </div>
                
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">PTO Sprints</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-gray-900">{data.stats.ptoCount}</span>
                    <span className="text-sm text-gray-500">/ 2 max</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">Uncommitted</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-gray-900">{data.stats.uncommittedCount}</span>
                    <span className="text-sm text-gray-500">future sprints</span>
                  </div>
                </div>
              </div>

              {/* Validation Status */}
              <Alert className={data.stats.isValid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                {data.stats.isValid ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <AlertDescription className={data.stats.isValid ? "text-green-800" : "text-red-800"}>
                  {data.stats.isValid 
                    ? "Sprint commitments are valid - Your current planning meets all distribution requirements for the 6-sprint window."
                    : "Sprint commitments need adjustment - Please ensure minimum 2 Build sprints and maximum 2 PTO sprints in the 6-sprint window."
                  }
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Historic Sprints */}
          <div className="lg:col-span-1">
            <Card className="border border-gray-200">
              <CardHeader className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <History className="text-gray-400 h-5 w-5" />
                  <CardTitle className="text-lg font-semibold text-gray-900">Historic Sprints</CardTitle>
                </div>
                <p className="text-sm text-gray-600 mt-1">Past sprint commitments</p>
              </CardHeader>
              
              <CardContent className="p-6 space-y-4">
                {data.sprints.historic.map((sprint) => (
                  <div key={sprint.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getSprintTypeColor(sprint.type)}`}></div>
                        <Badge className={getSprintTypeBadgeColor(sprint.type)}>
                          {sprint.type ? sprint.type.charAt(0).toUpperCase() + sprint.type.slice(1) : 'Uncommitted'}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">Completed</span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">{formatDateRange(sprint.startDate, sprint.endDate)}</span>
                    </div>
                    {sprint.description && (
                      <p className="text-sm text-gray-700">{sprint.description}</p>
                    )}
                  </div>
                ))}
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
                {data.sprints.current && (
                  <div className={`border-l-4 rounded-r-lg p-4 ${
                    data.sprints.current.type === 'build' ? 'border-blue-500 bg-blue-50' :
                    data.sprints.current.type === 'test' ? 'border-green-500 bg-green-50' :
                    data.sprints.current.type === 'pto' ? 'border-amber-500 bg-amber-50' :
                    'border-gray-500 bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full ${getSprintTypeColor(data.sprints.current.type)}`}></div>
                        <span className={`font-semibold ${
                          data.sprints.current.type === 'build' ? 'text-blue-600' :
                          data.sprints.current.type === 'test' ? 'text-green-600' :
                          data.sprints.current.type === 'pto' ? 'text-amber-600' :
                          'text-gray-600'
                        }`}>
                          {data.sprints.current.type ? 
                            `${data.sprints.current.type.charAt(0).toUpperCase() + data.sprints.current.type.slice(1)} Sprint` :
                            'Uncommitted Sprint'
                          }
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Active</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Sprint Period</span>
                        <p className="text-sm text-gray-900 font-mono">{formatDateRange(data.sprints.current.startDate, data.sprints.current.endDate)}</p>
                      </div>
                      
                      {data.sprints.current.description && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Commitment</span>
                          <p className="text-sm text-gray-900 mt-1">{data.sprints.current.description}</p>
                        </div>
                      )}
                      
                      <div className={`flex items-center justify-between pt-2 border-t ${
                        data.sprints.current.type === 'build' ? 'border-blue-200' :
                        data.sprints.current.type === 'test' ? 'border-green-200' :
                        data.sprints.current.type === 'pto' ? 'border-amber-200' :
                        'border-gray-200'
                      }`}>
                        <span className="text-xs text-gray-600">Days remaining</span>
                        <span className="text-sm font-semibold text-gray-900">{data.stats.daysRemaining} days</span>
                      </div>
                    </div>
                  </div>
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
                    <Calendar className="text-gray-400 h-5 w-5" />
                    <CardTitle className="text-lg font-semibold text-gray-900">Future Sprints</CardTitle>
                  </div>
                  <Button 
                    onClick={handleSaveCommitments}
                    disabled={updateCommitmentsMutation.isPending}
                    size="sm"
                    className="text-sm"
                  >
                    {updateCommitmentsMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mt-1">Plan upcoming sprint commitments</p>
              </CardHeader>
              
              <CardContent className="p-6 space-y-4">
                {data.sprints.future.map((sprint, index) => {
                  const currentCommitment = commitments[sprint.id] || {};
                  const currentType = currentCommitment.type || sprint.type || '';
                  const currentDescription = currentCommitment.description || sprint.description || '';
                  
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
                            value={currentType}
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
                             "Description required for Build sprints"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8">
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600 font-medium">All systems operational</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Database className="text-gray-400 h-4 w-4" />
                    <span className="text-sm font-medium text-gray-700">Database</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-600">Connected</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Webhook className="text-gray-400 h-4 w-4" />
                    <span className="text-sm font-medium text-gray-700">Webhooks</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-600">Ready</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <RotateCcw className="text-gray-400 h-4 w-4" />
                    <span className="text-sm font-medium text-gray-700">Sprint Sync</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-600">Active</span>
                  </div>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Dashboard for: <span className="font-medium">{data.user.username}</span>
                </span>
                <Button
                  onClick={() => completeDashboardMutation.mutate()}
                  disabled={completeDashboardMutation.isPending}
                  size="sm"
                  variant="outline"
                >
                  {completeDashboardMutation.isPending ? "Sending..." : "Send Welcome Webhook"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
