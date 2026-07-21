# MegaByAI Face-Pass Implementation Plan

**Goal:** Channel-level face-pass (default on) with local 1600+WebP preprocess then POST to face.83zi.com.

**Tasks:**
1. DTO `MegabyaiFacePass *bool` + megabyai preprocess/upload helpers + wire `BuildRequestBody`
2. Unit tests (resize, switch semantics, mock upload optional)
3. classic + default channel UI switch, default checked
