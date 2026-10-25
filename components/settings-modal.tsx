"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Bell,
  ChevronRight,
  FileText,
  Globe,
  Lock,
  Mail,
  MessageCircle,
  Moon,
  Shield,
  User,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { useTheme } from "next-themes";

const formSchema = z.object({
  language: z.string(),
  theme: z.string(),
  emailNotifications: z.boolean(),
  lineNotification: z.boolean(),
  twoFactorAuth: z.boolean(),
  fullName: z.string().optional(),
  email: z.string().email().optional(),
});

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "profile" | "notifications" | "appearance" | "security" | "about";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "appearance", label: "Appearance" },
  { id: "security", label: "Security" },
  { id: "about", label: "About" },
];

function Row({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mf-set-row">
      <span className="mf-row-icon">{icon}</span>
      <span className="mf-set-label">
        {label}
        {hint ? <span className="mf-set-hint">{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [userProfile, setUserProfile] = React.useState<Profile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("profile");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      language: "en",
      theme: theme || "system",
      emailNotifications: true,
      lineNotification: false,
      twoFactorAuth: false,
      fullName: "",
      email: "",
    },
  });

  React.useEffect(() => {
    if (mounted && theme) form.setValue("theme", theme);
  }, [theme, mounted, form]);

  React.useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isOpen) return;

      setIsLoadingProfile(true);
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (user) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (profileError) console.error("Error fetching profile:", profileError);

          if (profileData) {
            setUserProfile({
              id: profileData.id,
              email: user.email || profileData.email || "user@mfu.ac.th",
              full_name: profileData.full_name || null,
              role: profileData.role,
              avatar_url: profileData.avatar_url,
              created_at: profileData.created_at,
              updated_at: profileData.updated_at,
            });
          } else {
            setUserProfile({
              id: user.id,
              email: user.email || "user@mfu.ac.th",
              full_name: user.user_metadata?.full_name || null,
              role: (user.user_metadata?.role as "student" | "teacher") || "student",
              avatar_url: user.user_metadata?.avatar_url || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        // demo accounts have no Supabase session — the shell already falls back
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [isOpen]);

  React.useEffect(() => {
    if (userProfile) {
      form.reset({
        language: form.getValues("language"),
        theme: form.getValues("theme"),
        emailNotifications: form.getValues("emailNotifications"),
        lineNotification: form.getValues("lineNotification"),
        twoFactorAuth: form.getValues("twoFactorAuth"),
        fullName: userProfile.full_name || "",
        email: userProfile.email || "",
      });
    }
  }, [userProfile, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Settings saved:", values);
    onClose();
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
      onClose();
    }
  };

  React.useEffect(() => {
    if (!isOpen) form.reset();
  }, [isOpen, form]);

  React.useEffect(() => {
    if (!isOpen) {
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  React.useEffect(() => {
    return () => {
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
    };
  }, []);

  const isDark = mounted ? theme === "dark" : false;
  const roleLabel =
    userProfile?.role === "teacher" ? "Teacher Mode" : userProfile?.role === "admin" ? "Admin Mode" : "Student Mode";
  const showsSaveButton = activeTab !== "about";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="mf-set-dialog"
        showCloseButton={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="mf-set-head">
          <h2 className="mf-set-title">
            {activeTab === "about" ? "Settings" : "Settings"}
          </h2>
          <button type="button" className="mf-set-close" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className="mf-set-body">
          <nav className="mf-set-rail" aria-label="Settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="mf-set-tab"
                data-active={activeTab === tab.id ? "true" : "false"}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="mf-set-pane">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                {activeTab === "profile" && (
                  <>
                    <p className="mf-set-section">Account</p>
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <Row icon={<User size={18} />} label="Full name">
                            <FormControl>
                              <input
                                {...field}
                                className="mf-set-input"
                                placeholder="Enter your name"
                                disabled={isLoadingProfile}
                              />
                            </FormControl>
                          </Row>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <Row icon={<Mail size={18} />} label="Email">
                            <FormControl>
                              <input
                                {...field}
                                type="email"
                                className="mf-set-input"
                                placeholder="Enter your email"
                                disabled={isLoadingProfile}
                              />
                            </FormControl>
                          </Row>
                        </FormItem>
                      )}
                    />
                    <Row icon={<Shield size={18} />} label="Role">
                      <span className="mf-set-value">
                        {isLoadingProfile ? "Loading…" : roleLabel}
                        <ChevronRight size={16} className="mf-set-chevron" />
                      </span>
                    </Row>
                  </>
                )}

                {activeTab === "notifications" && (
                  <>
                    <p className="mf-set-section">Notifications</p>
                    <FormField
                      control={form.control}
                      name="emailNotifications"
                      render={({ field }) => (
                        <FormItem>
                          <Row icon={<Bell size={18} />} label="Email notifications" hint="Receive updates by email">
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </Row>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lineNotification"
                      render={({ field }) => (
                        <FormItem>
                          <Row icon={<MessageCircle size={18} />} label="LINE notifications" hint="Receive updates in LINE">
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </Row>
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {activeTab === "appearance" && (
                  <>
                    <p className="mf-set-section">General</p>
                    <FormField
                      control={form.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <Row icon={<Globe size={18} />} label="Language">
                            <FormControl>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="mf-set-value" style={{ border: 0, background: "transparent", height: 32, padding: 0, gap: 6 }}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="en">English</SelectItem>
                                  <SelectItem value="th">ไทย</SelectItem>
                                  <SelectItem value="zh">中文</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <ChevronRight size={16} className="mf-set-chevron" />
                          </Row>
                        </FormItem>
                      )}
                    />
                    <Row icon={<Moon size={18} />} label="Dark mode">
                      <Switch
                        checked={isDark}
                        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                      />
                    </Row>
                  </>
                )}

                {activeTab === "security" && (
                  <>
                    <p className="mf-set-section">Security</p>
                    <FormField
                      control={form.control}
                      name="twoFactorAuth"
                      render={({ field }) => (
                        <FormItem>
                          <Row icon={<Shield size={18} />} label="Two-factor authentication" hint="Extra step when signing in">
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </Row>
                        </FormItem>
                      )}
                    />
                    <Row icon={<Lock size={18} />} label="Change password">
                      <Link href="/reset-password" className="mf-set-value" style={{ textDecoration: "none" }}>
                        <ChevronRight size={16} className="mf-set-chevron" />
                      </Link>
                    </Row>
                  </>
                )}

                {activeTab === "about" && (
                  <>
                    <p className="mf-set-section">Terms and policies</p>
                    <Row icon={<FileText size={18} />} label="Terms of service">
                      <Link href="/terms" className="mf-set-value" style={{ textDecoration: "none" }}>
                        <ChevronRight size={16} className="mf-set-chevron" />
                      </Link>
                    </Row>
                    <Row icon={<FileText size={18} />} label="Privacy policy">
                      <Link href="/terms" className="mf-set-value" style={{ textDecoration: "none" }}>
                        <ChevronRight size={16} className="mf-set-chevron" />
                      </Link>
                    </Row>
                    <Row icon={<Mail size={18} />} label="Contact us">
                      <Link href="/contact" className="mf-set-value" style={{ textDecoration: "none" }}>
                        <ChevronRight size={16} className="mf-set-chevron" />
                      </Link>
                    </Row>
                  </>
                )}

                {showsSaveButton && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 18 }}>
                    <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm">
                      Save changes
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </div>
        </div>

        <div className="mf-set-foot">
          <p className="mf-set-company">
            Mae Fah Luang University · 333 Moo 1, Thasud, Muang, Chiang Rai 57100, Thailand
            <br />
            AI Teaching Assistant · internal learning platform. Verify important information with the university.
          </p>
          <span className="mf-set-wordmark">
            MFU<span>AI</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
