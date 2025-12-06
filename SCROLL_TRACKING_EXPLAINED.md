# Scroll Tracking - How It Works

## The Problem We Solved

Previously, scroll tracking measured how far down the **entire page** the user scrolled. This was inaccurate because:
- Different filter combinations show different numbers of classes
- A user scrolling 50% on 20 classes is different from 50% on 5 classes
- We couldn't tell if users actually viewed the filtered results

## The Solution

### 1. Track Scroll Relative to Classes Grid

**Old way:**
```javascript
// Measured scroll on entire page
const scrollDepth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
```

**New way:**
```javascript
// Measures scroll within the classes grid container
const classesGrid = document.getElementById('classes-grid');
const scrolledIntoGrid = window.scrollY + window.innerHeight - gridTop;
const scrollDepth = (scrolledIntoGrid / gridHeight) * 100;
```

This means:
- ✅ 50% = User scrolled halfway through the **filtered classes**
- ✅ 100% = User scrolled to the bottom of the **filtered classes**
- ✅ Accurate regardless of how many classes are shown

### 2. Reset Scroll Tracking on Filter Change

When a user changes filters:
1. The classes list changes (different content)
2. We reset the scroll tracking to 0%
3. Start tracking fresh for the new filter combination

**Example Journey:**
```
1. Visited site
2. Searched for Style: hip-hop
3. Scrolled to 75% (of hip-hop classes)
4. Searched for Day: wednesday
5. Scrolled to 50% (of hip-hop + wednesday classes)
6. Clicked register
```

### 3. Show Maximum Scroll Depth Per Filter Combo

The admin dashboard shows the **highest scroll depth** reached for each filter combination.

**Why?**
- User might scroll down, then back up, then down again
- We care about how much they explored, not current position
- Maximum depth shows engagement level

**Example:**
```
User scrolls: 25% → 50% → 40% → 75% → 60%
Dashboard shows: 75% (the maximum)
```

## How It Appears in Admin Dashboard

### Before (Inaccurate):
```
🚪 Visited site →
🔍 Searched for Style: hip-hop →
📜 Scrolled to 25% →
📜 Scrolled to 50% →
🔍 Searched for Day: wednesday →
📜 Scrolled to 25% →
✅ Clicked register
```

### After (Accurate):
```
🚪 Visited site →
🔍 Searched for Style: hip-hop →
📜 Scrolled to 50% of hip-hop classes →
🔍 Searched for Day: wednesday →
📜 Scrolled to 75% of hip-hop + wednesday classes →
✅ Clicked register
```

## What This Tells You

### High Scroll Depth (75-100%)
- ✅ User thoroughly explored the filtered results
- ✅ Engaged with the content
- ✅ Viewed most/all available classes

### Medium Scroll Depth (50-74%)
- ⚠️ User viewed about half the classes
- ⚠️ Might have found what they wanted
- ⚠️ Or might have lost interest

### Low Scroll Depth (25-49%)
- ❌ User barely scrolled
- ❌ Might not have found relevant classes
- ❌ Filter combination might not be useful

### No Scroll (0%)
- ❌ User didn't scroll at all
- ❌ Immediately changed filters
- ❌ Results might not match expectations

## Real-World Examples

### Example 1: Engaged User
```
🚪 Visited site →
🔍 Searched for Age: elementary →
📜 Scrolled to 100% →
🔍 Searched for Style: ballet →
📜 Scrolled to 75% →
✅ Clicked register for "Ballet Basics"
```

**Interpretation:**
- User explored ALL elementary classes
- Then narrowed to ballet
- Scrolled through most ballet classes
- Found and registered for a class
- **High engagement, successful journey!**

### Example 2: Struggling User
```
🚪 Visited site →
🔍 Searched for Style: hip-hop →
📜 Scrolled to 25% →
🔍 Searched for Day: monday →
📜 Scrolled to 0% →
🔍 Cleared Day filter →
📜 Scrolled to 50% →
🔍 Searched for Age: teen
```

**Interpretation:**
- User trying different filters
- Low scroll depths = not finding what they want
- Multiple filter changes = searching
- **Struggling to find relevant classes**

### Example 3: Quick Decision
```
🚪 Visited site →
🔍 Searched for Style: contemporary →
📜 Scrolled to 25% →
✅ Clicked register for "Contemporary Dance"
```

**Interpretation:**
- User knew what they wanted
- Found it quickly (top of results)
- Low scroll but successful conversion
- **Efficient journey!**

## Technical Implementation

### Client-Side (analytics.js)

1. **Track scroll on classes grid:**
   - Get grid position and height
   - Calculate scroll percentage within grid
   - Track milestones: 25%, 50%, 75%, 100%

2. **Reset on filter change:**
   - When filter changes, reset max scroll to 0%
   - Start tracking fresh for new results

3. **Send events:**
   - Each milestone sends a `scroll_depth` event
   - Includes depth percentage

### Server-Side (admin.html)

1. **Process journey:**
   - Group scroll events by filter combination
   - Find maximum scroll depth for each combo
   - Insert max scroll before next filter/action

2. **Display:**
   - Show one scroll event per filter combo
   - Display as "Scrolled to X%"
   - Purple badge for visibility

## Benefits

### For You (Site Owner)
- ✅ Understand which filter combinations are useful
- ✅ See if users explore filtered results
- ✅ Identify where users lose interest
- ✅ Optimize class listings based on scroll patterns

### For Analytics Accuracy
- ✅ Scroll depth relative to actual content
- ✅ Resets per filter combination
- ✅ Shows maximum engagement level
- ✅ Cleaner, more meaningful journeys

### For Decision Making
- ✅ Know if users find relevant classes
- ✅ Identify popular filter combinations
- ✅ See which combos lead to conversions
- ✅ Understand user exploration patterns

## Future Enhancements

Possible additions:
- **Average scroll depth per filter combo** - See typical engagement
- **Scroll heatmap** - Visualize where users stop scrolling
- **Time spent scrolling** - How long they explore
- **Scroll velocity** - Fast scroll = scanning, slow = reading

---

**The key insight:** Scroll tracking is now **context-aware** - it measures engagement with the actual filtered content, not just page position.
