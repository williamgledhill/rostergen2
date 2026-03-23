"use client";
import React from "react";
import { Download, Plus, Sparkles, Menu, Save, RotateCcw } from "lucide-react";
import { useNav } from "@/components/NavContext";

export default function TopBar({
  navOpen,
  onToggleNav,
  showActions = true,
}: {
  navOpen?: boolean;
  onToggleNav?: () => void;
  showActions?: boolean;
}) {
  const nav = useNav();
  const isOpen = navOpen ?? nav.navOpen;
  const toggleNav = onToggleNav ?? nav.toggleNav;

  function handleAddEmployee(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new CustomEvent("roster:add-employee"));
    }
  }
  function handleExport(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-export"));
    }
  }
  function handleSave(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-save"));
    }
  }
  function handleAutofill(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-autofill"));
    }
  }
  function handleReset(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-reset"));
    }
  }

  return (
    <header className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
      <div className="flex min-h-[38px] items-center gap-2">
        {!isOpen && (
          <div className="flex items-center gap-2">
            <button
              className="btn px-2"
              onClick={toggleNav}
              aria-pressed={isOpen}
              title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        )}
        {showActions && (
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn whitespace-nowrap" onClick={handleSave}>
              <Save className="w-4 h-4" /> Save
            </button>
            <button className="btn whitespace-nowrap" onClick={handleExport}>
              <Download className="w-4 h-4" /> Export
            </button>
            <button className="btn whitespace-nowrap" onClick={handleAutofill}>
              <Sparkles className="w-4 h-4" /> Autofill
            </button>
            <button className="btn whitespace-nowrap" onClick={handleAddEmployee}>
              <Plus className="w-4 h-4" /> Add Employee
            </button>
            <button className="btn whitespace-nowrap" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
