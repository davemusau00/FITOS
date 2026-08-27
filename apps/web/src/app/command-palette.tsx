import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, type IconName } from "@fitos/ui";

type CommandItem = {
  id: string;
  label: string;
  type: "Navigation" | "Action";
  icon: IconName;
  to: string;
  keywords?: string;
};

const commands: CommandItem[] = [
  // Navigation
  {
    id: "nav-today",
    label: "Today / Overview",
    type: "Navigation",
    icon: "dashboard",
    to: "/app/overview",
    keywords: "dashboard home kpis metrics"
  },
  {
    id: "nav-schedule",
    label: "Schedule Calendar",
    type: "Navigation",
    icon: "calendar",
    to: "/app/schedule",
    keywords: "timetable classes sessions events calendar"
  },
  {
    id: "nav-bookings",
    label: "Bookings List",
    type: "Navigation",
    icon: "calendar",
    to: "/app/bookings",
    keywords: "reservations bookings appointments"
  },
  {
    id: "nav-attendance",
    label: "Attendance & Logs",
    type: "Navigation",
    icon: "check",
    to: "/app/attendance",
    keywords: "check-in checkin roster arrivals logs"
  },
  {
    id: "nav-reception",
    label: "Front Desk Reception",
    type: "Navigation",
    icon: "check",
    to: "/app/reception",
    keywords: "front desk fast checkin scanner arrivals"
  },
  {
    id: "nav-members",
    label: "Members Directory",
    type: "Navigation",
    icon: "users",
    to: "/app/members",
    keywords: "clients people customers users profiles"
  },
  {
    id: "nav-memberships",
    label: "Memberships & Plans",
    type: "Navigation",
    icon: "shield",
    to: "/app/memberships",
    keywords: "subscriptions plans passes credits"
  },
  {
    id: "nav-leads",
    label: "Leads Pipeline & CRM",
    type: "Navigation",
    icon: "user",
    to: "/app/leads",
    keywords: "prospects pipeline inquiries trials sales crm kanban"
  },
  {
    id: "nav-insights",
    label: "Insights & Growth Analytics",
    type: "Navigation",
    icon: "dashboard",
    to: "/app/insights",
    keywords: "analytics reports charts heatmaps retention stats"
  },
  {
    id: "nav-automations",
    label: "Automations & Workflows",
    type: "Navigation",
    icon: "spark",
    to: "/app/automations",
    keywords: "automation workflows rules triggers templates email sms"
  },
  {
    id: "nav-services",
    label: "Services & Classes",
    type: "Navigation",
    icon: "spark",
    to: "/app/services",
    keywords: "classes workouts personal training packages"
  },
  {
    id: "nav-staff",
    label: "Staff & Coaches",
    type: "Navigation",
    icon: "team",
    to: "/app/staff",
    keywords: "trainers coaches employees team instructors"
  },
  {
    id: "nav-settings",
    label: "Settings",
    type: "Navigation",
    icon: "settings",
    to: "/app/settings",
    keywords: "organization branches preferences config security"
  },

  // Quick Actions
  {
    id: "act-new-member",
    label: "Add New Member",
    type: "Action",
    icon: "plus",
    to: "/app/members/new",
    keywords: "create member new signup register client"
  },
  {
    id: "act-new-booking",
    label: "Book a Class / Session",
    type: "Action",
    icon: "calendar",
    to: "/app/bookings/new",
    keywords: "reserve schedule class appointment booking"
  },
  {
    id: "act-new-lead",
    label: "Create New Lead",
    type: "Action",
    icon: "plus",
    to: "/app/leads/new",
    keywords: "add prospect trial inquiry sales lead"
  },
  {
    id: "act-org-settings",
    label: "Organization Profile",
    type: "Action",
    icon: "building",
    to: "/app/settings/organization",
    keywords: "brand timezone company details"
  },
  {
    id: "act-branches",
    label: "Manage Branches",
    type: "Action",
    icon: "building",
    to: "/app/settings/branches",
    keywords: "locations gyms studios facilities"
  }
];

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = commands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.type.toLowerCase().includes(q) ||
      cmd.keywords?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via parent
          const event = new CustomEvent("open-command-palette");
          window.dispatchEvent(event);
        }
      }
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          navigate(selected.to);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, filtered, selectedIndex, navigate]);

  if (!isOpen) return null;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-search">
          <Icon name="search" size={18} />
          <input
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, search pages or actions..."
            ref={inputRef}
            type="text"
            value={query}
          />
        </div>

        <ul className="cmd-results">
          {filtered.length === 0 ? (
            <li
              style={{
                padding: "1.5rem",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.875rem"
              }}
            >
              No results found for &ldquo;{query}&rdquo;
            </li>
          ) : (
            filtered.map((item, idx) => (
              <li
                className={`cmd-result ${idx === selectedIndex ? "is-active" : ""}`}
                key={item.id}
                onClick={() => {
                  navigate(item.to);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="cmd-result__icon">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="cmd-result__label">{item.label}</span>
                <span className="cmd-result__type">{item.type}</span>
              </li>
            ))
          )}
        </ul>

        <div className="cmd-footer">
          <span className="cmd-hint">
            <kbd>↑</kbd> <kbd>↓</kbd> navigate
          </span>
          <span className="cmd-hint">
            <kbd>↵</kbd> select
          </span>
          <span className="cmd-hint" style={{ marginLeft: "auto" }}>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
