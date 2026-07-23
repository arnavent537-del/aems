"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Badge, Button } from "@/components/ui";
import { Activity, RefreshCw, Users, UserX } from "lucide-react";

interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  role: string;
  action: string;
  details: string;
  createdAt: string;
}

interface OnlineUser {
  id: string;
  username: string;
  role: string;
  lastActive: string;
  clients: string[];
}

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [activitiesRes, onlineRes] = await Promise.all([
        fetch("/api/activities?limit=100"),
        fetch("/api/users/online"),
      ]);

      const activitiesData = await activitiesRes.json();
      const onlineData = await onlineRes.json();

      setActivities(activitiesData.activities || []);
      setOnlineUsers(onlineData.users || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    loadData();
  }

  const getActionBadge = (action: string): "slate" | "green" | "red" | "amber" | "blue" | "purple" => {
    const colors: Record<string, "slate" | "green" | "red" | "amber" | "blue" | "purple"> = {
      LOGIN: "green",
      LOGOUT: "slate",
      CREATE_EMPLOYEE: "blue",
      UPDATE_EMPLOYEE: "amber",
      DELETE_EMPLOYEE: "red",
      IMPORT_EMPLOYEES: "purple",
      CREATE_ATTENDANCE: "blue",
      UPDATE_ATTENDANCE: "amber",
      CREATE_ADVANCE: "blue",
      APPROVE_ADVANCE: "green",
      CREATE_SALARY: "blue",
      PASSWORD_RESET: "amber",
      MARK_EXIT: "red",
      REACTIVATE_EMPLOYEE: "green",
    };
    return colors[action] || "slate";
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activity Log & Online Users</h1>
          <p className="text-sm text-slate-500">Track user activities and see who is currently online.</p>
        </div>
        <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Online Users Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-slate-800">Online Users</h2>
            <Badge color="green">{onlineUsers.length}</Badge>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : onlineUsers.length === 0 ? (
            <p className="text-sm text-slate-400">No users currently online</p>
          ) : (
            <div className="space-y-3">
              {onlineUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{user.username}</p>
                      <p className="text-xs text-slate-500">{user.role} {user.clients.length > 0 && `• ${user.clients.join(", ")}`}</p>
                    </div>
                  </div>
                  <span className="text-xs text-green-600">{formatTime(user.lastActive)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Activity Log Section */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">Recent Activities</h2>
            <Badge color="blue">{activities.length}</Badge>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-slate-400">No activities recorded yet</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <div className="flex items-start gap-3">
                    <Badge color={getActionBadge(activity.action)}>
                      {activity.action}
                    </Badge>
                    <div>
                      <p className="text-sm text-slate-700">{activity.details}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {activity.username} ({activity.role})
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {formatTime(activity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}