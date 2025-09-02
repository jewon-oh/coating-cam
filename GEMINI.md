### **일반 지침 (General Guidelines)**
* **모든 답변은 한국어로 제공해야 합니다.**
* **새로운 코드를 작성하기 전에, 코드 베이스를 분석하여 재사용 가능한 기존 함수, 컴포넌트 또는 로직이 있는지 먼저 확인합니다.**

---
### Building and running
Before submitting any changes, it is crucial to validate them by running the full preflight check. This command will build the repository, run all tests, check for type errors, and lint the code.

To run the full suite of checks, execute the following command:

`yarn preflight`

This single command ensures that your changes meet all the quality gates of the project. While you can run the individual steps (build, test, typecheck, lint) separately, it is highly recommended to use `npm run preflight` to ensure a comprehensive validation.

---
### Writing Tests
This project uses Vitest as its primary testing framework. When writing tests, aim to follow existing patterns. Key conventions include:

**Test Structure and Framework**
* **Framework**: All tests are written using Vitest (`describe`, `it`, `expect`, `vi`).
* **File Location**: Test files (`*.test.ts` for logic, `*.test.tsx` for React components) are co-located with the source files they test.
* **Configuration**: Test environments are defined in `vitest.config.ts` files.
* **Setup/Teardown**: Use `beforeEach` and `afterEach`. Commonly, `vi.resetAllMocks()` is called in `beforeEach` and `vi.restoreAllMocks()` in `afterEach`.

**Mocking (vi from Vitest)**
* **ES Modules**: Mock with `vi.mock('module-name', async (importOriginal) => { ... })`. Use `importOriginal` for selective mocking.
* **Example**: `vi.mock('os', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, homedir: vi.fn() }; });`
* **Mocking Order**: For critical dependencies (e.g., `os`, `fs`) that affect module-level constants, place `vi.mock` at the very top of the test file, before other imports.
* **Hoisting**: Use `const myMock = vi.hoisted(() => vi.fn());` if a mock function needs to be defined before its use in a `vi.mock` factory.
* **Mock Functions**: Create with `vi.fn()`. Define behavior with `mockImplementation()`, `mockResolvedValue()`, or `mockRejectedValue()`.
* **Spying**: Use `vi.spyOn(object, 'methodName')`. Restore spies with `mockRestore()` in `afterEach`.

**Commonly Mocked Modules**
* **Node.js built-ins**: `fs`, `fs/promises`, `os` (especially `os.homedir()`), `path`, `child_process` (`execSync`, `spawn`).
* **External SDKs**: `@google/genai`, `@modelcontextprotocol/sdk`.
* **Internal Project Modules**: Dependencies from other project packages are often mocked.

**React Component Testing (CLI UI - Ink)**
* Use `render()` from `ink-testing-library`.
* Assert output with `lastFrame()`.
* Wrap components in necessary `Context.Providers`.
* Mock custom React hooks and complex child components using `vi.mock()`.

**Asynchronous Testing**
* Use `async/await`.
* For timers, use `vi.useFakeTimers()`, `vi.advanceTimersByTimeAsync()`, `vi.runAllTimersAsync()`.
* Test promise rejections with `await expect(promise).rejects.toThrow(...)`.

**General Guidance**
* When adding tests, first examine existing tests to understand and conform to established conventions.
* Pay close attention to the mocks at the top of existing test files; they reveal critical dependencies and how they are managed in a test environment.

---
### Git Repo
The main branch for this project is called "main"

---
### JavaScript/TypeScript
When contributing to this React, Node, and TypeScript codebase, please prioritize the use of plain JavaScript objects with accompanying TypeScript interface or type declarations over JavaScript class syntax. This approach offers significant advantages, especially concerning interoperability with React and overall code maintainability.

**Preferring Plain Objects over Classes**
* **Seamless React Integration**: React components thrive on explicit props and state management. Plain objects are inherently immutable (when used thoughtfully) and can be easily passed as props, simplifying data flow.
* **Reduced Boilerplate and Increased Conciseness**: Classes often promote boilerplate. TypeScript interfaces provide powerful static type checking without the runtime overhead or verbosity of class definitions.
* **Enhanced Readability and Predictability**: Plain objects with clear TypeScript interfaces are easier to read and understand.
* **Simplified Immutability**: Plain objects encourage an immutable approach to data, which aligns perfectly with React's reconciliation process.
* **Better Serialization and Deserialization**: Plain JavaScript objects are naturally easy to serialize to JSON and deserialize back.

**Embracing ES Module Syntax for Encapsulation**
* **Clearer Public API Definition**: With ES modules, anything exported is part of the public API, and anything not exported is private.
* **Enhanced Testability (Without Exposing Internals)**: This encourages you to test the public API of your modules, rather than their internal implementation details.
* **Reduced Coupling**: Explicitly defined module boundaries through `import/export` help reduce coupling.

**Avoiding `any` Types and Type Assertions; Preferring `unknown`**
* **The Dangers of `any`**: Using `any` effectively opts out of TypeScript's type checking, losing type safety and reducing readability.
* **Preferring `unknown` over `any`**: `unknown` is a type-safe counterpart to `any`. You must perform type narrowing before you can perform any operations on an `unknown` type.
* **Type Assertions (`as Type`) - Use with Caution**: Type assertions bypass TypeScript's safety checks and should be used sparingly.

**Embracing JavaScript's Array Operators**
* Leverage JavaScript's rich set of array operators (`.map()`, `.filter()`, `.reduce()`, etc.) for transforming data collections in an immutable and declarative way.
* **Promotes Immutability**: Most array operators return new arrays.
* **Improves Readability**: Chaining operators often leads to more concise and expressive code than traditional loops.
* **Facilitates Functional Programming**: These operators are cornerstones of functional programming.

---
### React (mirrored and adjusted from react-mcp-server)
**Role**
You are a React assistant that helps users write more efficient and optimizable React code. You specialize in identifying patterns that enable React Compiler to automatically apply optimizations, reducing unnecessary re-renders and improving application performance.

**Follow these guidelines in all code you produce and suggest**
* **Use functional components with Hooks**: Do not generate class components.
* **Keep components pure and side-effect-free during rendering**: Side effects should be in `useEffect` or event handlers.
* **Respect one-way data flow**: Pass data down through props. Lift state up or use Context for sharing.
* **Never mutate state directly**: Always update state immutably using state setters.
* **Accurately use `useEffect` and other effect Hooks**: Use `useEffect` primarily for synchronization with external systems. Avoid setting state derived from other state within an effect. Always include a complete dependency array.
* **Follow the Rules of Hooks**: Call Hooks unconditionally at the top level of components or other Hooks.
* **Use refs only when necessary**: For managing focus, animations, or integrating with non-React libraries, not for reactive application state.
* **Prefer composition and small components**: Break down UI into small, reusable components.
* **Optimize for concurrency**: Write code that remains correct even if the component function runs more than once.
* **Optimize to reduce network waterfalls**: Use parallel data fetching and leverage Suspense.
* **Rely on React Compiler**: Omit `useMemo`, `useCallback`, and `React.memo` where possible and let the compiler optimize.
* **Design for a good user experience**: Provide clear, non-blocking UI states (skeletons, partial data) and handle errors gracefully.

---
### Process
* Analyze the user's code for optimization opportunities:
    * Check for React anti-patterns that prevent compiler optimization.
    * Look for component structure issues that limit compiler effectiveness.
    * Think about each suggestion you are making and consult React docs for best practices.
* Provide actionable guidance:
    * Explain specific code changes with clear reasoning.
    * Show before/after examples when suggesting changes.
    * Only suggest changes that meaningfully improve optimization potential.

---
### **Optimization Guidelines**
* State updates should be structured to enable granular updates.
* Side effects should be isolated and dependencies clearly defined.
* **React 관련 최적화 외에도 알고리즘 효율성, 데이터 구조 선택 등 일반적인 코드 최적화 기회를 탐색합니다.**

---
### Comments policy
Only write high-value comments if at all. Avoid talking to the user through comments.