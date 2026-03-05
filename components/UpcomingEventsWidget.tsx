"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

interface CalendarEvent {
    id: string;
    summary: string;
    start: {
        dateTime?: string;
        date?: string;
    };
    calendarId: string;
}

export function UpcomingEventsWidget() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // 1. Fetch available calendars
                const listRes = await fetch("/api/calendar/list");
                if (!listRes.ok) return;
                const listData = await listRes.json();

                if (!listData.calendars || listData.calendars.length === 0) {
                    setLoading(false);
                    return;
                }

                // 2. Extract IDs specifically for "primary" or fallback to first
                // Use the same logic as Agenda page to ensure consistency
                let targetCalendars = listData.calendars.filter((c: any) => c.primary);

                if (targetCalendars.length === 0 && listData.calendars.length > 0) {
                    targetCalendars = [listData.calendars[0]];
                }

                if (targetCalendars.length === 0) {
                    setLoading(false);
                    return;
                }

                const calendarIds = targetCalendars.map((c: any) => `${c.integrationId}:${c.id}`);

                // 3. Fetch events
                const eventsRes = await fetch(`/api/calendar/events?calendarIds=${encodeURIComponent(calendarIds.join(","))}`);
                if (!eventsRes.ok) return;
                const eventsData = await eventsRes.json();

                // 4. Take top 4
                if (eventsData.events) {
                    // Filter out past events just in case API returns them (though API filters by timeMin=now)
                    const futureEvents = eventsData.events.slice(0, 4);
                    setEvents(futureEvents);
                }
            } catch (error) {
                console.error("Failed to fetch upcoming events:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    if (loading) {
        return <div className="mt-8 text-gray-500 text-sm animate-pulse">Carregando eventos...</div>;
    }

    if (events.length === 0) {
        return (
            <div className="mt-4 md:mt-8 border-none md:border-t md:border-white/10 pt-0 md:pt-8">
                <div className="p-6 bg-gray-900/30 border border-white/5 rounded-xl text-center">
                    <p className="text-gray-400 text-sm">Nenhum evento próximo encontrado.</p>
                    <p className="text-xs text-gray-600 mt-1">Verifique se sua agenda está conectada.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-4 md:mt-8 border-none md:border-t md:border-white/10 pt-0 md:pt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {events.map((event, index) => {
                    const startDate = new Date(event.start.dateTime || event.start.date || "");
                    const dateStr = startDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
                    const timeStr = event.start.dateTime
                        ? startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : "Dia Inteiro";

                    return (
                        <div
                            key={event.id}
                            className={`bg-gray-900/50 border border-white/10 p-4 rounded-xl hover:bg-gray-800/50 transition-colors ${index > 0 ? 'hidden md:block' : ''}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider bg-purple-500/10 px-2 py-1 rounded-md">
                                    {dateStr}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {timeStr}
                                </span>
                            </div>
                            <h3 className="text-sm font-medium text-white line-clamp-2" title={event.summary}>
                                {event.summary || "Sem título"}
                            </h3>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
