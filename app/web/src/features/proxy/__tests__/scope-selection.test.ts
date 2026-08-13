/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { proxyNodeDefaultScopeValue } from "../proxy-node-scope";

describe("proxy node scope defaults", () => {
  test("selects the first channel ID when changing to channel scope", () => {
    assert.equal(
      proxyNodeDefaultScopeValue(
        "channel",
        [
          { id: 12, name: "fallback" },
          { id: 20, name: "secondary" },
        ],
        ["default"],
      ),
      "12",
    );
  });

  test("selects the first group when changing to group scope", () => {
    assert.equal(
      proxyNodeDefaultScopeValue(
        "group",
        [{ id: 12, name: "fallback" }],
        ["default", "research"],
      ),
      "default",
    );
  });

  test("keeps all scope value empty", () => {
    assert.equal(
      proxyNodeDefaultScopeValue("all", [{ id: 12, name: "fallback" }], ["default"]),
      "",
    );
  });
});
