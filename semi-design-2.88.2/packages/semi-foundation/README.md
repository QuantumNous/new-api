> The infrastructure layer is used to build modern component libraries. 


Semi UI adopts a set of cross-front-end framework technical solutions to split the JavaScript of each component into two parts: `Foundation` and `Adapter`.
This allows us to reuse Foundation code across frameworks by only re-implementing the adapter, e.g, React and Vue. Quickly build common component libraries on different platforms.

-   **Foundation**

    `Foundation` contains the business logic that best represents `Semi Design` without actually referencing any DOM elements. `Foundation` delegates `Adapter` methods for any logic that requires DOM manipulation

-   **Adapter**

    `Adapter` is an interface that has all the methods needed by `Foundation` to implement `Semi Design` business logic. `Adapter` can have many implementations, allowing interoperability with different frameworks.

## Directory Structure

 ```
  ├── semi-foundation         // Foundation and Stylesheet of component
  │   ├── utils
  │   └── tooltip
  │       ├── constants.js    // Constant definition, including numbers, strings, cssClass
  │       ├── foundation.js   // Core foundation
  │       ├── tooltip.scss    // Stylesheet
  │       ├── mixin.scss      // Scss mixin
  │       ├── rtl.scss        // Rtl 
  │       ├── variables.scss  // Scss variable

```

## Related documents

[Technical solutions](https://bytedance.feishu.cn/docs/doccnTgc0iGOVPubHZkwPpxXSNh)
    
![image](https://lf1-cdn-tos.bytescm.com/obj/ttfe/ies/uikits/F_A.png)


## License

MIT
