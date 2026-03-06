"use client";
import React, { createContext, useContext } from "react";

type NavCtx = { navOpen: boolean; toggleNav: () => void };

const NavContext = createContext<NavCtx>({ navOpen: true, toggleNav: () => {} });

export const useNav = () => useContext(NavContext);

export const NavProvider = ({ value, children }: { value: NavCtx; children: React.ReactNode }) => (
  <NavContext.Provider value={value}>{children}</NavContext.Provider>
);
