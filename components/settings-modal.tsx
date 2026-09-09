"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bell, Palette, Shield, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { useTheme } from "next-themes";

const formSchema = z.object({
  language: z.string(),
  theme: z.string(),
  emailNotifications: z.boolean().default(false),
  lineNotification: z.boolean().default(false),
  twoFactorAuth: z.boolean().default(false),
  fullName: z.string().optional(),
  email: z.string().email().optional(),
});

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [userProfile, setUserProfile] = React.useState<Profile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);

  // Handle mounting to avoid hydration mismatch
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

  // Update form when theme changes
  React.useEffect(() => {
    if (mounted && theme) {
      form.setValue("theme", theme);
    }
  }, [theme, mounted, form]);

  const [activeTab, setActiveTab] = React.useState<"notifications" | "personalization" | "security" | "profile">("profile");

  // Fetch user profile data
  React.useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isOpen) return;
      
      setIsLoadingProfile(true);
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error("Error getting user:", userError);
          throw userError;
        }
        
        if (user) {
          // Fetch profile data from profiles table
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (profileError) {
            console.error("Error fetching profile:", profileError);
          }

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
            // Fallback to user data if profile not found
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
        console.error("Error fetching user profile:", error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [isOpen]);

  // Update form values when user profile is loaded
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
    // Here you would typically save to your backend
    onClose();
  }

  const handleOpenChange = (open: boolean) => {
    console.log('SettingsModal handleOpenChange called', open);
    if (!open) {
      // Immediately clean up body styles
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
      onClose();
    }
  };

  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  // Force cleanup of body styles when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      // Force remove pointer-events from body
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  // Additional cleanup on every render when modal is closed
  React.useEffect(() => {
    if (!isOpen) {
      const cleanup = () => {
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
      };
      cleanup();
      // Run cleanup multiple times to ensure it sticks
      const timeout1 = setTimeout(cleanup, 0);
      const timeout2 = setTimeout(cleanup, 10);
      const timeout3 = setTimeout(cleanup, 50);
      
      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
      };
    }
  }, [isOpen]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Ensure cleanup when component unmounts
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] h-[85vh] sm:w-[900px] sm:h-[600px] md:w-[960px] md:h-[640px] max-w-none overflow-hidden p-0">
        <div className="grid grid-cols-1 sm:grid-cols-12 h-full">
          {/* Left rail */}
          <div className="col-span-12 sm:col-span-3 sm:border-r border-b sm:border-b-0 bg-muted/20 p-2 sm:p-3 h-auto sm:h-full overflow-x-auto sm:overflow-y-auto">
            <div className="text-xs uppercase tracking-wide text-muted-foreground px-2 pb-2 sm:block hidden">Settings</div>
            <div className="flex sm:flex-col gap-2">
              {[
                { id: "profile", label: "Profile", icon: User },
                { id: "notifications", label: "Notifications", icon: Bell },
                { id: "personalization", label: "Personalization", icon: Palette },
                { id: "security", label: "Security", icon: Shield },
              ].map((i) => (
                <button
                  key={i.id}
                  onClick={() => setActiveTab(i.id as typeof activeTab)}
                  className={`${activeTab === i.id ? "bg-accent text-accent-foreground shadow-sm" : "hover:bg-muted"} w-full inline-flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap`}
                >
                  <i.icon className="h-4 w-4 opacity-70 shrink-0" />
                  <span className="flex-1 text-left">{i.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right content */}
          <div className="col-span-12 sm:col-span-9 p-4 sm:p-6 overflow-y-auto h-full">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl capitalize">{activeTab}</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                {activeTab === "profile" && (
                  <div className="rounded-lg border bg-background divide-y">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem className="m-0 flex flex-row items-center justify-between px-4 py-3">
                          <div className="space-y-0.5 flex-1 mr-4">
                            <FormLabel className="text-base">Full Name</FormLabel>
                          </div>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="min-w-[200px]"
                              placeholder="Enter your name"
                              disabled={isLoadingProfile}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="m-0 flex flex-row items-center justify-between px-4 py-3">
                          <div className="space-y-0.5 flex-1 mr-4">
                            <FormLabel className="text-base">Email</FormLabel>
                          </div>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email"
                              className="min-w-[200px]"
                              placeholder="Enter your email"
                              disabled={isLoadingProfile}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {/* Mode Display */}
                    <div className="m-0 px-4 py-3">
                      <div className="text-base font-medium">
                        {isLoadingProfile ? (
                          <span className="text-muted-foreground">Loading...</span>
                        ) : (
                          userProfile?.role === "student" ? "Student Mode" : 
                          userProfile?.role === "teacher" ? "Teacher Mode" : 
                          "Student Mode"
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "personalization" && (
                  <div className="rounded-lg border bg-background divide-y">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-sm font-medium">Theme</div>
                        <div className="text-muted-foreground text-sm">Light, Dark, or System</div>
                      </div>
                      <FormField
                        control={form.control}
                        name="theme"
                        render={({ field }) => (
                          <FormItem className="min-w-[160px]">
                            <Select 
                              value={mounted ? (theme || "system") : "system"} 
                              onValueChange={(value) => {
                                field.onChange(value);
                                setTheme(value);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="light">Light</SelectItem>
                                <SelectItem value="dark">Dark</SelectItem>
                                <SelectItem value="system">System</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {activeTab === "notifications" && (
                  <div className="rounded-lg border bg-background divide-y">
                    <FormField
                      control={form.control}
                      name="emailNotifications"
                      render={({ field }) => (
                        <FormItem className="m-0 flex flex-row items-center justify-between px-4 py-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Email Notifications</FormLabel>
                            <FormDescription>Receive notifications via email</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lineNotification"
                      render={({ field }) => (
                        <FormItem className="m-0 flex flex-row items-center justify-between px-4 py-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Line notification</FormLabel>
                            <FormDescription>Receive notifications via Line</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {activeTab === "security" && (
                  <div className="rounded-lg border bg-background divide-y">
                    <FormField
                      control={form.control}
                      name="twoFactorAuth"
                      render={({ field }) => (
                        <FormItem className="m-0 flex flex-row items-center justify-between px-4 py-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Two-Factor Authentication</FormLabel>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                  <Button type="submit">Save Settings</Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
