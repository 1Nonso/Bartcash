/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    BARTCASH DESIGN SYSTEM                               ║
 * ║                    Usage & Reference Guide                              ║
 * ║                    Version 1.0 — February 2026                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * This file is the single reference document for every token, component,
 * and hook in the BartCash codebase. Read this before building any screen.
 *
 * TABLE OF CONTENTS
 * ─────────────────
 * 1.  Project Setup & Path Aliases
 * 2.  Constants / Theme
 *       2a. Colors
 *       2b. Typography
 *       2c. Spacing, Radius, Shadows, Layout
 * 3.  Components
 *       3a. BartCash Design System Components  (NEW — added for BartCash)
 *       3b. Scaffold Components                (from Expo template — kept & reconciled)
 * 4.  Hooks
 * 5.  Reconciliation Notes (ThemedText / ThemedView / useThemeColor)
 * 6.  Icon Mapping Reference (IconSymbol)
 * 7.  What to Delete
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. PROJECT SETUP & PATH ALIASES
// ═══════════════════════════════════════════════════════════════════════════
//
// Your Expo scaffold uses metro bundler, not webpack. Path aliases are
// configured in tsconfig.json only — NO babel.config.js needed for Expo.
//
// Your tsconfig.json should have (or already has):
//
//   {
//     "compilerOptions": {
//       "baseUrl": ".",
//       "paths": {
//         "@/*": ["./*"]
//       }
//     }
//   }
//
// This means @/constants/colors resolves to ./constants/colors.ts,
// @/components/button resolves to ./components/button.tsx, etc.
//
// After moving the design system files, your folder layout should be:
//
//   constants/
//     colors.ts          ← (new) replaces old theme.ts — flat BartCash tokens
//     typography.ts      ← (new) all text styles + FontSize + FontWeight
//     spacing.ts         ← (new) Spacing, Radius, Shadows, Layout, ZIndex
//     index.ts           ← barrel export: export * from './colors'; etc.
//
//   components/
//     button.tsx                ← (new) BartCash Button
//     input.tsx                 ← (new) BartCash Input
//     badge.tsx                 ← (new) ConditionBadge, Chip, AIValueTag, etc.
//     listing-card.tsx          ← (new) ListingCard
//     ai-value-card.tsx         ← (new) AIValueCard, AIComparisonCard, TradeOfferCard
//     bottom-tab-bar.tsx        ← (new) BottomTabBar + tabBarStyleConfig
//     form-section.tsx          ← (new) FormSection, FieldLabel, TipBox, etc.
//     photo-uploader.tsx        ← (new) PhotoUploader, VideoUploader
//     collapsible.tsx           ← (kept) accordion component
//     external-link.tsx         ← (kept) in-app browser link
//     haptic-tab.tsx            ← (kept) tab bar haptic feedback button
//     themed-text.tsx           ← (kept, updated) see Section 5
//     themed-view.tsx           ← (kept, updated) see Section 5
//     ui/
//       icon-symbol.tsx         ← (kept) Android/web icon fallback
//       icon-symbol.ios.tsx     ← (kept) iOS SF Symbols
//
//   hooks/
//     use-color-scheme.ts       ← (kept) thin re-export of RN hook
//     use-color-scheme.web.ts   ← (kept) hydration-safe web version
//     use-theme-color.ts        ← (kept, updated import path) see Section 5

// ═══════════════════════════════════════════════════════════════════════════
// 2a. COLORS  →  constants/colors.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// Import:
//   import { Colors } from '@/constants/colors';
//   // or via barrel:
//   import { Colors } from '@/constants';
//
// ── Brand Primitives ────────────────────────────────────────────────────────
//
//   Colors.primary          #1D1B20   Black — primary buttons, headings, nav
//   Colors.white            #FFFFFF   Pure white — card surfaces
//   Colors.background       #F5F5F5   Page background (light gray)
//   Colors.surface          #FFFFFF   Card / sheet surface
//   Colors.surfaceVariant   #FAFAFA   Input bg, secondary surfaces
//
// ── AI / Purple Accent ──────────────────────────────────────────────────────
//
//   Colors.ai               #6750A4   Purple — AI value label, progress bar fill
//   Colors.aiLight          #E8DEF8   Light purple chip background
//   Colors.aiSurface        #F7F2FA   Subtle AI section background tint
//
// ── Semantic ────────────────────────────────────────────────────────────────
//
//   Colors.success          #518740   Green — "New" badge, fair trade indicator
//   Colors.successLight     #E8F5E3   Light green background
//   Colors.danger           #F00004   Red — delete, reject, errors, destructive
//   Colors.dangerLight      #FEE2E2   Light red background
//   Colors.info             #0800F9   Blue — links, "Accepted" offer status
//   Colors.infoLight        #EEF2FF   Light blue background
//   Colors.warning          #F9CB00   Yellow — "Pending" offer status
//   Colors.warningLight     #FEF9C3   Light yellow background
//
// ── Offer Status Badges ──────────────────────────────────────────────────────
//   Each has { text, background, dot } keys.
//
//   Colors.statusPending    yellow tones   (#92400E text / #FEF9C3 bg)
//   Colors.statusAccepted   green tones    (#166534 text / #DCFCE7 bg)
//   Colors.statusRejected   red tones      (#991B1B text / #FEE2E2 bg)
//   Colors.statusCountered  blue tones     (#1E3A8A text / #EEF2FF bg)
//   Colors.statusSold       gray tones     (#374151 text / #F3F4F6 bg)
//
// ── Text ────────────────────────────────────────────────────────────────────
//
//   Colors.text.primary     #1D1B20   Headings, body
//   Colors.text.secondary   #49454F   Meta info, subtitles
//   Colors.text.tertiary    #625B71   Timestamps, captions
//   Colors.text.placeholder #757575   Input placeholder
//   Colors.text.disabled    #B3B3B3   Disabled state
//   Colors.text.inverse     #FFFFFF   Text on dark backgrounds
//   Colors.text.link        #0800F9   Tappable links
//   Colors.text.danger      #F00004   Inline validation errors
//
// ── Borders & Dividers ───────────────────────────────────────────────────────
//
//   Colors.border.default   #CAC4D0   Card borders, input borders
//   Colors.border.subtle    #E6E6E6   Dividers, section separators
//   Colors.border.strong    #B2B2B2   Emphasized borders
//   Colors.border.focus     #1D1B20   Input focused state border
//
// ── Gray Scale ───────────────────────────────────────────────────────────────
//
//   Colors.gray[50]   #FAFAFA
//   Colors.gray[100]  #F5F5F5
//   Colors.gray[200]  #E6E6E6
//   Colors.gray[300]  #D9D9D9
//   Colors.gray[400]  #B3B3B3
//   Colors.gray[500]  #767676
//   Colors.gray[600]  #625B71
//   Colors.gray[700]  #49454F
//   Colors.gray[800]  #2C2C2C
//   Colors.gray[900]  #1E1E1E
//
// ── Tab Bar ──────────────────────────────────────────────────────────────────
//
//   Colors.tabBar.background    #FFFFFF
//   Colors.tabBar.active        #1D1B20
//   Colors.tabBar.inactive      #757575
//   Colors.tabBar.border        #E6E6E6
//   Colors.tabBar.sellButton    #1D1B20   (the circle + button)
//   Colors.tabBar.sellButtonIcon #FFFFFF
//
// ── Overlay / Transparency ───────────────────────────────────────────────────
//
//   Colors.overlay.dark     rgba(0,0,0,0.50)
//   Colors.overlay.light    rgba(255,255,255,0.90)
//   Colors.overlay.card     rgba(0,0,0,0.10)
//   Colors.overlay.badge    rgba(0,0,0,0.25)
//   Colors.overlay.input    rgba(0,0,0,0.15)
//
// ── Light/Dark Structure (for ThemedText / useThemeColor compatibility) ───────
// Add this block to the bottom of colors.ts so the scaffold hooks continue
// to work without modification:
//
//   export const ThemeColors = {
//     light: {
//       text:       '#1D1B20',
//       background: '#F5F5F5',
//       tint:       '#6750A4',
//       icon:       '#49454F',
//       tabIconDefault:  '#757575',
//       tabIconSelected: '#1D1B20',
//     },
//     dark: {
//       text:       '#F5F5F5',
//       background: '#1D1B20',
//       tint:       '#A78BFA',
//       icon:       '#CAC4D0',
//       tabIconDefault:  '#625B71',
//       tabIconSelected: '#F5F5F5',
//     },
//   } as const;
//
// Then in use-theme-color.ts, update the import to:
//   import { ThemeColors as Colors } from '@/constants/colors';
// (See Section 5 for full reconciliation instructions)

// ═══════════════════════════════════════════════════════════════════════════
// 2b. TYPOGRAPHY  →  constants/typography.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// Import:
//   import { Typography, FontSize, FontWeight } from '@/constants/typography';
//
// ── Font Scale (FontSize) ────────────────────────────────────────────────────
//
//   FontSize.xs     11sp   Timestamps, micro labels
//   FontSize.sm     12sp   Captions, badges, meta info
//   FontSize.base   13sp   Secondary body
//   FontSize.md     14sp   Body, inputs, list items        ← most common
//   FontSize.lg     15sp   Emphasized body
//   FontSize.xl     17sp   Card titles, section titles
//   FontSize['2xl'] 20sp   Screen subtitles
//   FontSize['3xl'] 24sp   Page titles (Discover, Search)
//   FontSize['4xl'] 28sp   Large headers
//   FontSize['5xl'] 32sp   Hero headers
//
// ── Font Weights (FontWeight) ────────────────────────────────────────────────
//
//   FontWeight.regular    '400'
//   FontWeight.medium     '500'
//   FontWeight.semibold   '600'
//   FontWeight.bold       '700'
//   FontWeight.extrabold  '800'
//
// ── Semantic Text Styles (Typography) ───────────────────────────────────────
// All are TextStyle objects ready to spread into StyleSheet:
//
//   Typography.pageTitle          24sp bold    — "Discover", "Search", "My Listings"
//   Typography.sectionTitle       17sp bold    — Section headers within pages
//   Typography.cardTitle          14sp semibold— Listing card title (grid)
//   Typography.cardTitleLarge     20sp bold    — Listing Detail, Offer screens
//   Typography.offerTitle         17sp bold    — "Razer BlackWidow V3..."
//   Typography.body               14sp regular — Standard body text
//   Typography.bodyMedium         14sp medium  — Emphasized body
//   Typography.caption            12sp regular — Meta: "Brand New • Gadget • 2 days ago"
//   Typography.captionMedium      12sp medium  — AI value labels
//   Typography.micro              11sp regular — Timestamps, tiny labels
//   Typography.inputLabel         14sp semibold— Form field labels
//   Typography.input              14sp regular — Input field text
//   Typography.button             14sp semibold— Button labels (all sizes)
//   Typography.buttonSm           12sp semibold— Small button labels
//   Typography.tabLabel           11sp medium  — Bottom tab bar labels
//   Typography.badge              11sp semibold— Condition/status badge text
//   Typography.aiValue            28sp bold    — "$85 - $95", "N330k" price display
//   Typography.matchScore         14sp bold    — "80%" trade match score
//   Typography.formSectionTitle   15sp bold    — "Basic Information", "Photos & Videos"
//   Typography.hint               12sp regular — Tip text, privacy notices
//   Typography.navLabel           14sp regular — Back navigation labels
//   Typography.statNumber         17sp bold    — Profile stats: "12", "48", "156"
//   Typography.statLabel          11sp regular — Profile stat labels: "Listings", "Sold"

// ═══════════════════════════════════════════════════════════════════════════
// 2c. SPACING, RADIUS, SHADOWS, LAYOUT  →  constants/spacing.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// Import:
//   import { Spacing, Radius, Shadows, Layout, ZIndex } from '@/constants/spacing';
//
// ── Spacing Scale ─────────────────────────────────────────────────────────────
// Base-4 system. Use Spacing[n] not raw numbers in StyleSheet.
//
//   Spacing[0.5]  2px     Micro gap (inline elements)
//   Spacing[1]    4px     Tight padding, icon margins
//   Spacing[1.5]  6px     Between badge elements
//   Spacing[2]    8px     Small padding — most icon spacing
//   Spacing[2.5]  10px
//   Spacing[3]    12px    Row gaps, internal card spacing
//   Spacing[3.5]  14px
//   Spacing[4]    16px    Standard screen horizontal padding   ← most common
//   Spacing[5]    20px    Generous padding
//   Spacing[6]    24px    Card padding, section gaps
//   Spacing[8]    32px    Large section spacing
//   Spacing[10]   40px
//   Spacing[12]   48px    Screen-level spacing
//   Spacing[16]   64px    Hero spacing
//
// ── Border Radius ──────────────────────────────────────────────────────────────
//
//   Radius.xs     4px    Small elements, badges
//   Radius.sm     6px    Small buttons
//   Radius.md     8px    Inputs, small cards
//   Radius.lg     12px   Standard cards               ← most common
//   Radius.xl     16px   Large cards, modals
//   Radius['2xl'] 20px   Filter bottom sheet
//   Radius['3xl'] 24px   Large bottom sheets
//   Radius.full   9999px Circular / pill shapes
//
// ── Shadows ────────────────────────────────────────────────────────────────────
// Platform-specific (iOS shadowColor/shadowRadius vs Android elevation).
//
//   Shadows.none    Flat — no shadow
//   Shadows.xs      Barely visible (subtle card outlines)
//   Shadows.sm      Listing cards, profile stats card
//   Shadows.md      Floating buttons, focused cards
//   Shadows.lg      Bottom sheets, modals
//   Shadows.xl      Tab bar, floating action buttons
//
//   Usage:
//     style={{ ...Shadows.sm, backgroundColor: Colors.white }}
//     ⚠️ Shadow only renders if backgroundColor is set on the same view.
//
// ── Layout Constants ────────────────────────────────────────────────────────────
//
//   Layout.screenPadding     16px   Horizontal page margin
//   Layout.gridGap            8px   Gap between listing grid cards
//   Layout.gridColumns          2   Cards per row in listing grid
//   Layout.tabBarHeight        60px Bottom tab bar height
//   Layout.headerHeight        56px Standard screen header
//   Layout.inputHeight         48px All form inputs
//   Layout.buttonHeight        48px Primary / large buttons
//   Layout.buttonHeightSm      36px Small / inline buttons
//   Layout.borderWidth          1px Standard border
//   Layout.borderWidthThick   1.5px Active/focused border
//   Layout.iconSm              16px Small icons
//   Layout.iconMd              20px Medium icons
//   Layout.iconLg              24px Large icons (tab bar, headers)
//   Layout.iconXl              28px Extra large icons
//   Layout.avatarXs            28px Inline avatar (chat list)
//   Layout.avatarSm            36px Small avatar
//   Layout.avatarMd            44px Standard avatar
//   Layout.avatarLg            56px Profile card avatar
//   Layout.avatarXl            80px Large profile page avatar
//
// ── Z-Index Stack ───────────────────────────────────────────────────────────────
//
//   ZIndex.base          0
//   ZIndex.card         10
//   ZIndex.overlay      20
//   ZIndex.header       30
//   ZIndex.tabBar       40
//   ZIndex.bottomSheet  50
//   ZIndex.modal        60
//   ZIndex.toast        70

// ═══════════════════════════════════════════════════════════════════════════
// 3a. BARTCASH DESIGN SYSTEM COMPONENTS  →  components/
// ═══════════════════════════════════════════════════════════════════════════

// ── Button  →  components/button.tsx ────────────────────────────────────────
//
// Import:
//   import { Button } from '@/components/button';
//
// Props:
//   variant?    'primary' | 'secondary' | 'ghost' | 'danger' | 'ai'
//               Default: 'primary'
//
//   size?       'lg' | 'md' | 'sm'
//               Default: 'lg'
//
//   label       string (required)
//   loading?    boolean — shows ActivityIndicator, disables press
//   fullWidth?  boolean — 100% width
//   leftIcon?   ReactNode — rendered left of label
//   rightIcon?  ReactNode — rendered right of label
//   disabled?   boolean
//   + all TouchableOpacityProps
//
// Variants:
//   primary    Black bg (#1D1B20), white text   — main CTAs
//              e.g. "Sign In", "Publish Listing", "Send trade offer"
//
//   secondary  White bg, gray border (#CAC4D0), black text
//              e.g. "Edit Listing Details", filter toggle buttons
//
//   ghost      Transparent bg, black text, no border
//              e.g. "Forgot Password?", inline text actions
//
//   danger     White bg, red border+text (#F00004)
//              e.g. "Delete Account"
//
//   ai         Black bg, white text (used with sparkle icon)
//              e.g. "Continue to AI Evaluation ✦"
//
// Examples:
//   <Button label="Sign In" variant="primary" size="lg" fullWidth />
//   <Button label="Delete Account" variant="danger" size="md" />
//   <Button label="Continue to AI Evaluation" variant="ai" leftIcon={<SparkleIcon />} />
//   <Button label="Saving..." loading />

// ── Input  →  components/input.tsx ──────────────────────────────────────────
//
// Import:
//   import { Input } from '@/components/input';
//
// Props:
//   label?               string — bold label above the input field
//   error?               string — red error text below field
//   hint?                string — gray hint text (only shown when no error)
//   showPasswordToggle?  boolean — shows eye/hide eye icon for password fields
//   containerStyle?      ViewStyle — style for the outer wrapper
//   leftElement?         ReactNode — icon/prefix inside the input (left)
//   rightElement?        ReactNode — icon/suffix inside the input (right)
//   + all TextInputProps (placeholder, value, onChangeText, etc.)
//
// States:
//   Default   — gray border (#CAC4D0)
//   Focused   — dark border (#1D1B20), slightly thicker
//   Error     — red border (#F00004) + red error message below
//   Disabled  — opacity 0.45
//
// Examples:
//   <Input label="Email Address" placeholder="example@gmail.com" keyboardType="email-address" />
//   <Input label="Password" showPasswordToggle secureTextEntry />
//   <Input label="Bio" multiline numberOfLines={4} style={{ height: 100 }} />
//   <Input error="Invalid email" label="Email" />

// ── Badge  →  components/badge.tsx ──────────────────────────────────────────
//
// Import:
//   import { ConditionBadge, OfferStatusBadge, Chip, AIValueTag, UnreadBadge }
//     from '@/components/badge';
//
// ConditionBadge
//   Props: condition: 'new' | 'used' | 'fair'
//   The green/gray pill overlay on listing card photos (top-left corner).
//   Mount it as an absolutely positioned overlay inside the image wrapper.
//   e.g. <ConditionBadge condition="new" style={styles.conditionOverlay} />
//
// OfferStatusBadge
//   Props: status: 'pending' | 'rejected' | 'accepted' | 'countered'
//   Inline colored text label next to the username on the Offers tab.
//   Colors: pending=yellow, rejected=red, accepted=green, countered=blue
//   e.g. <OfferStatusBadge status="pending" />
//
// Chip
//   Props: label: string, selected?: boolean
//   Category/filter pill buttons. Selected = black bg/white text.
//   Unselected = white bg/gray border/dark text.
//   e.g. <Chip label="Electronics" selected={activeCategory === 'electronics'} />
//
// AIValueTag
//   Props: value: string  (e.g. "N330k" or "$85")
//   The "↗ N330k • AI Value" line on listing cards and offer items.
//   e.g. <AIValueTag value="N330k" />
//
// UnreadBadge
//   Props: count?: number
//   Red dot with count for notification/message badges.
//   Returns null if count is 0 or undefined.
//   e.g. <UnreadBadge count={3} />

// ── ListingCard  →  components/listing-card.tsx ─────────────────────────────
//
// Import:
//   import { ListingCard } from '@/components/listing-card';
//   import type { ListingCardData } from '@/components/listing-card';
//
// Props:
//   data: ListingCardData {
//     id, title, condition, aiValue, distance?, image,
//     isFavourited?, views?, saves?, offers?
//   }
//
//   variant?            'marketplace' | 'mylistings' | 'favourite'
//                       Default: 'marketplace'
//
//   onPress?            () => void  — navigate to listing detail
//   onFavouritePress?   () => void  — toggle save/unsave
//   onOfferTradePress?  () => void  — open make offer flow
//   onEditPress?        () => void  — open edit listing (mylistings only)
//   onDeletePress?      () => void  — delete listing (mylistings only)
//
// Variants:
//   marketplace   Standard grid card with "Offer Trade ⇄" CTA.
//                 Used on: Home (Discover), Search results, Favourite.
//
//   mylistings    Adds stats row (views/saves/offers) + Edit/Delete buttons.
//                 Used on: My Listings screen.
//
//   favourite     Same as marketplace but heart is always filled red.
//                 Used on: Favourite screen (pre-saved items).
//
// Grid layout:
//   Render in a FlatList with numColumns={2} and columnWrapperStyle={{ gap: 8 }}.
//   The card width is determined by the parent — set width to ~(screenWidth - 40) / 2.
//
// Example:
//   <FlatList
//     data={listings}
//     numColumns={2}
//     columnWrapperStyle={{ gap: Layout.gridGap, paddingHorizontal: Layout.screenPadding }}
//     renderItem={({ item }) => (
//       <ListingCard
//         data={item}
//         variant="marketplace"
//         onPress={() => router.push(`/listing/${item.id}`)}
//         style={{ flex: 1 }}
//       />
//     )}
//   />

// ── AIValueCard / AIComparisonCard / TradeOfferCard  →  components/ai-value-card.tsx
//
// Import:
//   import { AIValueCard, AIComparisonCard, TradeOfferCard }
//     from '@/components/ai-value-card';
//
// AIValueCard
//   The AI Estimated Value display shown on Listing Detail + Review Listing screens.
//   Props:
//     value: string            e.g. "$85 - $95" or "N330k"
//     subtitle?: string        e.g. "Based on similar items and market data"
//     confidence: number       0–100 (fills the purple progress bar)
//     confidenceLabel: string  e.g. "High Confidence based on 127 similar items"
//
//   e.g. <AIValueCard value="$85 - $95" confidence={80} confidenceLabel="High Confidence based on 127 similar items" />
//
// AIComparisonCard
//   Two-column value comparison shown on the Make Offer screen.
//   Props:
//     yourValue: string         e.g. "$80 - $120"
//     theirValue: string        e.g. "$90 - $130"
//     matchScore: number        0–100
//     isFairTrade: boolean      shows/hides the green "This is a fair trade!" row
//     fairTradeLabel?: string   default: "This is a fair trade!"
//
//   e.g. <AIComparisonCard yourValue="$80 - $120" theirValue="$90 - $130" matchScore={80} isFairTrade />
//
// TradeOfferCard
//   The full embedded offer card displayed inline in the chat thread.
//   Includes the "Trade Offer / Expires in..." header, both item details,
//   the trade match score bar, and Accept/Reject buttons.
//   Props:
//     theyOffer: { title, condition, category, postedAt, aiValue }
//     yourOffer: { title, condition, category, postedAt, aiValue }
//     matchScore: number
//     isFairTrade: boolean
//     expiresIn: string         e.g. "23 hours 45 mins"
//     onAccept?: () => void
//     onReject?: () => void
//
//   e.g. <TradeOfferCard theyOffer={...} yourOffer={...} matchScore={80} isFairTrade expiresIn="23 hours 45 mins" onAccept={handleAccept} onReject={handleReject} />

// ── BottomTabBar  →  components/bottom-tab-bar.tsx ──────────────────────────
//
// Import:
//   import { BottomTabBar, tabBarStyleConfig } from '@/components/bottom-tab-bar';
//
// This file serves two purposes:
//
// 1. tabBarStyleConfig — plug into your expo-router tab layout:
//
//   // app/(tabs)/_layout.tsx
//   import { tabBarStyleConfig } from '@/components/bottom-tab-bar';
//   import { HapticTab } from '@/components/haptic-tab';
//
//   <Tabs
//     screenOptions={{
//       ...tabBarStyleConfig,
//       tabBarButton: HapticTab,           // adds haptic on iOS
//     }}
//   >
//     <Tabs.Screen name="index"   options={{ title: 'Home',    tabBarIcon: ... }} />
//     <Tabs.Screen name="search"  options={{ title: 'Search',  tabBarIcon: ... }} />
//     <Tabs.Screen name="sell"    options={{ title: '',        tabBarIcon: ... }} />  ← no label
//     <Tabs.Screen name="inbox"   options={{ title: 'Inbox',   tabBarIcon: ... }} />
//     <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ... }} />
//   </Tabs>
//
// 2. BottomTabBar — standalone presentational component (for Storybook / testing).
//   Props: activeTab: TabName, onTabPress: (tab) => void
//
// The "Sell" tab (center):
//   - Renders as a black circle with a + sign (no text label)
//   - Use tabBarIcon to render the styled circle, not tabBarLabel
//   - See IconSymbol mapping section (6) for icon names to use

// ── FormSection  →  components/form-section.tsx ─────────────────────────────
//
// Import:
//   import { FormSection, FormRow, FieldLabel, TipBox, PrivacyNotice }
//     from '@/components/form-section';
//
// FormSection
//   White card wrapper for form groups. Matches the card containers
//   on Create Listing, Edit Profile, and Settings screens.
//   Props: icon?, title, subtitle?, children, style?, bare?
//
//   bare=true removes the header — just renders the card container.
//
//   e.g.
//   <FormSection icon="ℹ️" title="Basic Information" subtitle="Tell us about your item">
//     <FieldLabel>Title</FieldLabel>
//     <Input placeholder="i.e. Wireless Earphone - Brand New" />
//   </FormSection>
//
// FormRow
//   Horizontal label+control row for Settings-style rows.
//   Props: label: string, children
//
//   e.g.
//   <FormRow label="Old Password">
//     <Input showPasswordToggle secureTextEntry />
//   </FormRow>
//
// FieldLabel
//   The bold label above individual form fields.
//   Props: children: string, required?: boolean
//   When required=true, appends a red asterisk.
//
//   e.g.
//   <FieldLabel required>Title</FieldLabel>
//   <Input placeholder="..." />
//
// TipBox
//   The gray info tip card shown in Create Listing / Make Offer.
//   Props: title?: string, items: string[]
//
//   e.g.
//   <TipBox
//     title="Tips for great media"
//     items={[
//       'Use natural lighting for photos',
//       'Show items from multiple angles',
//       'Include any flaws or wear in photo',
//       'Keep video short and focused',
//     ]}
//   />
//
// PrivacyNotice
//   The gray notice box in the Location section.
//   Props: text: string
//
//   e.g.
//   <PrivacyNotice text="Your exact address is never shared. We only show your general area to potential trade partners." />

// ── PhotoUploader / VideoUploader  →  components/photo-uploader.tsx ──────────
//
// Import:
//   import { PhotoUploader, VideoUploader } from '@/components/photo-uploader';
//
// PhotoUploader
//   The row of photo slots on Create Listing and Make Offer screens.
//   Props:
//     photos: (ImageSourcePropType | null)[]
//     maxPhotos?: number      default: 8
//     minPhotos?: number      default: 4
//     onAddPhoto: () => void  trigger expo-image-picker
//     onRemovePhoto?: (index: number) => void   long-press to remove
//
//   Always shows at least minPhotos slots. First filled slot is the cover photo.
//   Long-press a filled slot to remove it.
//
//   Integration with expo-image-picker:
//     import * as ImagePicker from 'expo-image-picker';
//
//     const handleAddPhoto = async () => {
//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Images,
//         allowsMultipleSelection: true,
//         quality: 0.8,
//       });
//       if (!result.canceled) {
//         // Compress with expo-image-manipulator before adding to state
//       }
//     };
//
// VideoUploader
//   The dashed full-width video upload area.
//   Props: videoUri?: string | null, onUpload: () => void

// ═══════════════════════════════════════════════════════════════════════════
// 3b. SCAFFOLD COMPONENTS  →  (from Expo template, kept & reconciled)
// ═══════════════════════════════════════════════════════════════════════════

// ── Collapsible  →  components/collapsible.tsx ────────────────────────────────
//
// Import:
//   import { Collapsible } from '@/components/collapsible';
//
// An accordion/expand-collapse section. Chevron rotates 90° when open.
// Uses ThemedText and ThemedView — respects light/dark mode.
//
// Props: title: string, children: ReactNode
//
// Use cases in BartCash:
//   - FAQ section (Help & Support screen)
//   - "Description" and "Looking For" sections in a listing detail (long text expand)
//   - Settings > Account details expandable rows
//
// e.g.
//   <Collapsible title="Is this item still under warranty?">
//     <ThemedText>Yes, the warranty is valid until December 2026.</ThemedText>
//   </Collapsible>

// ── ExternalLink  →  components/external-link.tsx ────────────────────────────
//
// Import:
//   import { ExternalLink } from '@/components/external-link';
//
// Opens URLs in an in-app browser (expo-web-browser) instead of leaving the app.
// On web, behaves as a standard <Link target="_blank">.
//
// Props: href: string (required), + all Link props
//
// Use cases in BartCash:
//   - "Terms & Conditions" link on Sign Up screen
//   - "Privacy Policy" link in Settings
//   - "Community Guidelines" in Settings
//   - Any external URL you don't want to build a native screen for
//
// e.g.
//   <ExternalLink href="https://bartcash.com/terms">
//     <ThemedText type="link">Terms & Conditions</ThemedText>
//   </ExternalLink>

// ── HapticTab  →  components/haptic-tab.tsx ──────────────────────────────────
//
// Import:
//   import { HapticTab } from '@/components/haptic-tab';
//
// Wraps tab bar buttons with iOS haptic feedback (light impact on press).
// No-op on Android (platform-guarded internally).
//
// Usage — pass as tabBarButton in expo-router layout:
//   <Tabs screenOptions={{ tabBarButton: HapticTab, ...tabBarStyleConfig }}>
//
// Do NOT use this component directly in screens. It's purely a tab bar config.

// ── ThemedText  →  components/themed-text.tsx ────────────────────────────────
//
// Import:
//   import { ThemedText } from '@/components/themed-text';
//
// A Text component that automatically applies the correct color for the
// current light/dark color scheme via useThemeColor.
//
// Props:
//   type?       'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link'
//               Default: 'default'
//   lightColor? string  — override light mode text color
//   darkColor?  string  — override dark mode text color
//   + all TextProps
//
// Type styles:
//   default          16sp, regular, auto-colored
//   defaultSemiBold  16sp, weight 600, auto-colored
//   title            32sp, bold, auto-colored
//   subtitle         20sp, bold, auto-colored
//   link             16sp, regular, color #0a7ea4 (hardcoded — update to Colors.text.link)
//
// ⚠️  See Section 5 for how ThemedText resolves colors with the new token system.
//
// Use ThemedText for screens that need to support dark mode automatically.
// Use BartCash's Typography styles directly for components with explicit design specs.

// ── ThemedView  →  components/themed-view.tsx ────────────────────────────────
//
// Import:
//   import { ThemedView } from '@/components/themed-view';
//
// A View component that automatically sets backgroundColor based on the
// current color scheme via useThemeColor.
//
// Props:
//   lightColor? string  — override light mode background
//   darkColor?  string  — override dark mode background
//   + all ViewProps
//
// e.g.
//   <ThemedView style={{ flex: 1, padding: 16 }}>
//     <ThemedText>Hello</ThemedText>
//   </ThemedView>
//
// ⚠️  See Section 5 for color resolution behavior.

// ── IconSymbol  →  components/ui/icon-symbol.tsx (Android/web)
//                   components/ui/icon-symbol.ios.tsx (iOS)
//
// See Section 6 for full icon mapping reference and how to extend it.

// ═══════════════════════════════════════════════════════════════════════════
// 4. HOOKS  →  hooks/
// ═══════════════════════════════════════════════════════════════════════════

// ── useColorScheme  →  hooks/use-color-scheme.ts
//                        hooks/use-color-scheme.web.ts
//
// Import:
//   import { useColorScheme } from '@/hooks/use-color-scheme';
//
// Returns: 'light' | 'dark' | null | undefined
//
// The .ts file is a thin re-export of React Native's built-in useColorScheme.
// The .web.ts file adds hydration safety for server-side rendering —
// it returns 'light' on the first render, then updates to the real scheme
// after hydration. This prevents a flash of wrong theme on web.
//
// Metro automatically picks the correct file per platform:
//   .web.ts  → used on web (Expo web target)
//   .ts      → used on iOS and Android
//
// Usage:
//   const colorScheme = useColorScheme() ?? 'light';
//   const isDark = colorScheme === 'dark';
//
//   // Direct usage with Colors:
//   const textColor = isDark ? Colors.text.inverse : Colors.text.primary;
//
// This hook is the foundation for useThemeColor (below).

// ── useThemeColor  →  hooks/use-theme-color.ts
//
// Import:
//   import { useThemeColor } from '@/hooks/use-theme-color';
//
// Returns the correct color value for the current color scheme.
// Used internally by ThemedText and ThemedView.
//
// Signature:
//   useThemeColor(
//     props: { light?: string; dark?: string },
//     colorName: keyof typeof ThemeColors.light & keyof typeof ThemeColors.dark
//   ): string
//
// colorName must be a key from the ThemeColors light/dark object:
//   'text' | 'background' | 'tint' | 'icon' | 'tabIconDefault' | 'tabIconSelected'
//
// How it resolves:
//   1. If props.light (or props.dark) is provided for the current scheme → use it.
//   2. Otherwise → look up ThemeColors[currentScheme][colorName].
//
// ⚠️  After your setup, update the import in this file from:
//   import { Colors } from '@/constants/theme';
// to:
//   import { ThemeColors as Colors } from '@/constants/colors';
// (See Section 5.)
//
// Direct usage example (in a custom component):
//   const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#1D1B20' }, 'background');
//   // Returns '#FFFFFF' in light mode, '#1D1B20' in dark mode.
//
//   const iconColor = useThemeColor({}, 'icon');
//   // Returns ThemeColors.light.icon or ThemeColors.dark.icon for current scheme.

// ═══════════════════════════════════════════════════════════════════════════
// 5. RECONCILIATION NOTES
//    (ThemedText / ThemedView / useThemeColor  ←→  New BartCash Tokens)
// ═══════════════════════════════════════════════════════════════════════════
//
// The scaffold components (ThemedText, ThemedView, useThemeColor) expect
// a Colors object shaped like:
//   Colors.light.text / Colors.dark.text
//   Colors.light.background / Colors.dark.background
//   etc.
//
// Your new flat Colors token (Colors.text.primary, Colors.background) has a
// different shape. Here's exactly what to do:
//
// STEP 1 — Add ThemeColors to constants/colors.ts
// ─────────────────────────────────────────────────
// At the bottom of your new colors.ts, add:
//
//   export const ThemeColors = {
//     light: {
//       text:            '#1D1B20',
//       background:      '#F5F5F5',
//       tint:            '#6750A4',     // AI purple as brand tint
//       icon:            '#49454F',
//       tabIconDefault:  '#757575',
//       tabIconSelected: '#1D1B20',
//     },
//     dark: {
//       text:            '#F5F5F5',
//       background:      '#1D1B20',
//       tint:            '#A78BFA',     // lighter purple for dark mode
//       icon:            '#CAC4D0',
//       tabIconDefault:  '#625B71',
//       tabIconSelected: '#F5F5F5',
//     },
//   } as const;
//
// STEP 2 — Update use-theme-color.ts
// ─────────────────────────────────────
// Change line 1 from:
//   import { Colors } from '@/constants/theme';
// to:
//   import { ThemeColors as Colors } from '@/constants/colors';
//
// That's it. No other changes needed. ThemedText and ThemedView will
// now resolve colors from your new token file.
//
// STEP 3 — Update Collapsible.tsx
// ────────────────────────────────
// Change:
//   import { Colors } from '@/constants/theme';
// to:
//   import { ThemeColors as Colors } from '@/constants/colors';
//
// And update the icon color references:
//   color={theme === 'light' ? ThemeColors.light.icon : ThemeColors.dark.icon}
//
// STEP 4 — Delete constants/theme.ts
// ─────────────────────────────────────
// Once Steps 1–3 are done, the old theme.ts is no longer imported anywhere.
// Delete it. The new constants/colors.ts, constants/typography.ts, and
// constants/spacing.ts replace it entirely.

// ═══════════════════════════════════════════════════════════════════════════
// 6. ICON MAPPING REFERENCE  →  components/ui/icon-symbol.tsx
// ═══════════════════════════════════════════════════════════════════════════
//
// IconSymbol uses SF Symbols on iOS (icon-symbol.ios.tsx) and maps to
// MaterialIcons on Android/web (icon-symbol.tsx).
//
// CURRENT MAPPINGS (from scaffold):
//   SF Symbol name                          → MaterialIcon name
//   'house.fill'                            → 'home'
//   'paperplane.fill'                       → 'send'
//   'chevron.left.forwardslash.chevron.right' → 'code'
//   'chevron.right'                         → 'chevron-right'
//
// MAPPINGS TO ADD for BartCash screens:
// Add these to the MAPPING object in icon-symbol.tsx:
//
//   // Tab Bar
//   'house'                   → 'home'
//   'magnifyingglass'         → 'search'
//   'plus.circle'             → 'add-circle-outline'
//   'message'                 → 'chat-bubble-outline'    (or 'forum')
//   'person'                  → 'person-outline'
//
//   // Listing / Marketplace
//   'heart'                   → 'favorite-border'
//   'heart.fill'              → 'favorite'
//   'location.fill'           → 'location-on'
//   'arrow.up.right'          → 'trending-up'           (AI value arrow)
//   'arrow.2.squarepath'      → 'swap-horiz'            (Offer Trade ⇄)
//   'camera.fill'             → 'camera-alt'
//   'photo.on.rectangle'      → 'photo-library'
//   'video.fill'              → 'videocam'
//   'sparkles'                → 'auto-awesome'          (AI sparkle icon)
//
//   // Profile / Account
//   'person.crop.circle'      → 'account-circle'
//   'pencil'                  → 'edit'
//   'trash'                   → 'delete-outline'
//   'gearshape'               → 'settings'
//   'star.fill'               → 'star'
//   'bell'                    → 'notifications-none'
//   'bell.fill'               → 'notifications'
//   'lock.fill'               → 'lock'
//   'eye'                     → 'visibility'
//   'eye.slash'               → 'visibility-off'
//
//   // Chat / Offers
//   'arrow.up.circle.fill'    → 'send'
//   'checkmark.circle.fill'   → 'check-circle'
//   'xmark.circle.fill'       → 'cancel'
//   'clock'                   → 'access-time'
//   'repeat'                  → 'repeat'
//
//   // Navigation
//   'chevron.left'            → 'chevron-left'
//   'ellipsis'                → 'more-vert'
//   'xmark'                   → 'close'
//   'checkmark'               → 'check'
//   'line.3.horizontal.decrease' → 'filter-list'        (Filter button)
//   'plus'                    → 'add'

// ═══════════════════════════════════════════════════════════════════════════
// 7. WHAT TO DELETE
// ═══════════════════════════════════════════════════════════════════════════
//
//   ❌  components/hello-wave.tsx
//         Expo default template demo. No use in BartCash.
//
//   ❌  components/parallax-scroll-view.tsx
//         Expo default template demo. BartCash listing detail uses a
//         static image carousel, not a parallax header.
//
//   ❌  constants/theme.ts  (your existing file)
//         Replaced by: constants/colors.ts + constants/typography.ts
//         Only delete AFTER completing the 4-step reconciliation in Section 5.
//
//   ✅  Everything else — keep.
