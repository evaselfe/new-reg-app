import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, User, Phone } from "lucide-react";
import { format, parseISO, isBefore, startOfToday } from "date-fns";
import { typedSupabase, TABLES } from "@/lib/supabase-utils";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
interface Agent {
  id: string;
  name: string;
  phone: string;
  role: string;
  panchayath_id: string;
}
interface DailyActivity {
  id: string;
  agent_id: string;
  mobile_number: string;
  activity_date: string;
  activity_description: string;
  created_at: string;
}
export const DailyActivityLog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'mobile' | 'calendar' | 'activity' | 'history'>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activityText, setActivityText] = useState('');
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const {
    toast
  } = useToast();
  const resetForm = () => {
    setStep('mobile');
    setMobileNumber('');
    setCurrentAgent(null);
    setSelectedDate(new Date());
    setActivityText('');
    setActivities([]);
  };
  const handleMobileSubmit = async () => {
    if (!mobileNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a mobile number",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      const {
        data,
        error
      } = await typedSupabase.from(TABLES.AGENTS).select('*').eq('phone', mobileNumber).limit(1).maybeSingle();
      if (error || !data) {
        toast({
          title: "Error",
          description: "Agent not found with this mobile number",
          variant: "destructive"
        });
        return;
      }
      setCurrentAgent(data);
      await fetchActivities(data.id);
      setStep('calendar');
    } catch (error) {
      console.error('Error finding agent:', error);
      toast({
        title: "Error",
        description: "Failed to find agent",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchActivities = async (agentId: string) => {
    try {
      const {
        data,
        error
      } = await typedSupabase.from(TABLES.DAILY_ACTIVITIES).select('*').eq('agent_id', agentId).order('activity_date', {
        ascending: false
      });
      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };
  const getDateColor = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const hasActivity = activities.some(activity => activity.activity_date === dateStr);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isPast = isBefore(date, yesterday);
    if (hasActivity) {
      return 'bg-green-100 text-green-800 hover:bg-green-200';
    } else if (isPast) {
      return 'bg-red-100 text-red-800 hover:bg-red-200';
    }
    return '';
  };
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isPast = isBefore(date, yesterday);
    const dateStr = format(date, 'yyyy-MM-dd');
    const existingActivity = activities.find(activity => activity.activity_date === dateStr);
    setSelectedDate(date);
    if (isPast && existingActivity) {
      // Show past activity in read-only mode
      setActivityText(existingActivity.activity_description);
      setStep('activity');
    } else if (isPast && !existingActivity) {
      // Past date with no activity - show in read-only
      setActivityText('No activity recorded for this date');
      setStep('activity');
    } else {
      // Today, yesterday, or future date - allow editing
      if (existingActivity) {
        setActivityText(existingActivity.activity_description);
      } else {
        setActivityText('');
      }
      setStep('activity');
    }
  };
  const saveActivity = async () => {
    if (!currentAgent || !selectedDate || !activityText.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      const activityDate = format(selectedDate, 'yyyy-MM-dd');

      // Check if activity already exists
      const existingActivity = activities.find(activity => activity.activity_date === activityDate);
      if (existingActivity) {
        // Update existing activity
        const {
          error
        } = await typedSupabase.from(TABLES.DAILY_ACTIVITIES).update({
          activity_description: activityText,
          updated_at: new Date().toISOString()
        }).eq('id', existingActivity.id);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Activity updated successfully"
        });
      } else {
        // Create new activity
        const {
          error
        } = await typedSupabase.from(TABLES.DAILY_ACTIVITIES).insert([{
          agent_id: currentAgent.id,
          mobile_number: mobileNumber,
          activity_date: activityDate,
          activity_description: activityText
        }]);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Activity saved successfully"
        });
      }
      await fetchActivities(currentAgent.id);
      setStep('history');
    } catch (error) {
      console.error('Error saving activity:', error);
      toast({
        title: "Error",
        description: "Failed to save activity",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isPastDate = selectedDate && isBefore(selectedDate, yesterday);
  const isReadOnly = isPastDate;
  return <Dialog open={isOpen} onOpenChange={open => {
    setIsOpen(open);
    if (!open) resetForm();
  }}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-slate-950 hover:bg-slate-800">
          <CalendarDays className="h-4 w-4" />
          Daily Activity Log
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Daily Activity Log</DialogTitle>
          <DialogDescription>
            Log and track daily activities for agents
          </DialogDescription>
        </DialogHeader>

        {step === 'mobile' && <div className="space-y-4">
            <div>
              <Label htmlFor="mobile">Mobile Number</Label>
              <div className="flex gap-2">
                <Input id="mobile" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="Enter mobile number" className="flex-1" />
                <Button onClick={handleMobileSubmit} disabled={loading}>
                  {loading ? "Finding..." : "Find Agent"}
                </Button>
              </div>
            </div>
          </div>}

        {step === 'calendar' && currentAgent && <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Agent Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Name:</span> {currentAgent.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span className="font-medium">Phone:</span> {currentAgent.phone}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{currentAgent.role}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label>Select Date</Label>
              <div className="text-sm text-muted-foreground mb-2">
                <span className="inline-block w-3 h-3 bg-green-100 border rounded mr-1"></span>
                Has activity
                <span className="inline-block w-3 h-3 bg-red-100 border rounded mr-1 ml-4"></span>
                No activity (past dates)
              </div>
              <div className="flex justify-center mt-2">
                <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} className="rounded-md border pointer-events-auto" modifiers={{
              hasActivity: date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                return activities.some(activity => activity.activity_date === dateStr);
              },
              noActivity: date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const isPast = isBefore(date, yesterday);
                return isPast && !activities.some(activity => activity.activity_date === dateStr);
              }
            }} modifiersStyles={{
              hasActivity: {
                backgroundColor: '#dcfce7',
                color: '#166534'
              },
              noActivity: {
                backgroundColor: '#fecaca',
                color: '#991b1b'
              }
            }} />
              </div>
            </div>
          </div>}

        {step === 'activity' && selectedDate && <div className="space-y-4">
            <div>
              <Label>
                Activity for {format(selectedDate, 'PPP')}
                {isReadOnly && <span className="text-muted-foreground ml-2">(Read Only)</span>}
              </Label>
              <Textarea value={activityText} onChange={e => setActivityText(e.target.value)} placeholder={isReadOnly ? "No activity recorded" : "Describe your daily activities..."} rows={6} className="mt-2" readOnly={isReadOnly} />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStep('calendar')} variant="outline">
                Back to Calendar
              </Button>
              {!isReadOnly && <Button onClick={saveActivity} disabled={loading} className="flex-1">
                  {loading ? "Saving..." : "Save Activity"}
                </Button>}
            </div>
          </div>}

        {step === 'history' && activities.length > 0 && <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Activity History</h3>
              <Button onClick={() => setStep('calendar')} variant="outline">
                Back to Calendar
              </Button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activities.map(activity => <Card key={activity.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(parseISO(activity.activity_date), 'PPP')}
                        </span>
                      </div>
                      <Badge variant="secondary">
                        {format(parseISO(activity.created_at), 'MMM dd, yyyy')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {activity.activity_description}
                    </p>
                  </CardContent>
                </Card>)}
            </div>
          </div>}

        {/* Add History Button in activity step */}
        {step === 'activity' && currentAgent && <div className="mt-4 pt-4 border-t">
            <Button variant="ghost" size="sm" onClick={() => setStep('history')} className="gap-2">
              <Clock className="h-4 w-4" />
              View History
            </Button>
          </div>}
      </DialogContent>
    </Dialog>;
};