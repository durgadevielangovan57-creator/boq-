# BUILDESTIMATE — Developer Context File
# READ THIS BEFORE STARTING ANY WORK

## Project Stack
- React + TypeScript + Tailwind + shadcn/ui + Wouter
- Backend: Node.js + Express + Supabase
- NEVER touch server/ folder or backend

## What Is Already Done
1. Sidebar.tsx — accordion collapsible sections ✅
   - Light theme (#F9FAFB) and Dark theme (#2563EB Royal Blue)
   - isDark state persists via localStorage key 'sidebar-theme'
   - Moon/Sun toggle button in sidebar header
   - X close button removed
   - Role-based accordion sections
   - Permission-based visibility using isVisible()

2. Header.tsx — sticky header inside content area ✅
   - Approvals dropdown (role-based, mirrors sidebar)
   - Search bar
   - Notification bell
   - User avatar with dropdown
   - permsLoaded state to prevent stale permissions
   - fetchPerms resets state on user change

3. Layout.tsx — Option B layout ✅
   - Header inside main content area only
   - Sidebar separate on left

## Key Rules
- NEVER touch server/ folder
- NEVER touch backend
- NEVER delete this file
- Always run npm run check after changes
- Always share screenshots after changes
- Create .bak before replacing large files

## Key Files
- client/src/components/layout/Sidebar.tsx
- client/src/components/layout/Header.tsx
- client/src/components/layout/Layout.tsx
- client/src/App.tsx

## Current Task
Fix Log Out button in Sidebar.tsx to match both themes:
- Light mode: bg #FEE2E2, text #EF4444
- Dark mode: bg rgba(255,255,255,0.1), text #FCA5A5

## CRITICAL RULE
NEVER use git checkout, git reset, or git revert.
These commands will destroy our work.

