/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

import ReactShallowRenderer from 'react-test-renderer/shallow';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMServer from 'react-dom/server';
import * as ReactTestUtils from 'react-dom/test-utils';

function getTestDocument(markup) {
  const doc = document.implementation.createHTMLDocument('');
  doc.open();
  doc.write(
    markup ||
      '<!doctype html><html><meta charset=utf-8><title>test doc</title>',
  );
  doc.close();
  return doc;
}

describe('ReactTestUtils', () => {
  it('Simulate should have locally attached media events', () => {
    expect(Object.keys(ReactTestUtils.Simulate).sort()).toMatchSnapshot();
  });

  it('gives Jest mocks a passthrough implementation with mockComponent()', () => {
    class MockedComponent extends React.Component {
      render() {
        throw new Error('Should not get here.');
      }
    }
    // This is close enough to what a Jest mock would give us.
    MockedComponent.prototype.render = jest.fn();

    // Patch it up so it returns its children.
    expect(() =>
      ReactTestUtils.mockComponent(MockedComponent),
    ).toWarnDev(
      'ReactTestUtils.mockComponent() is deprecated. ' +
        'Use shallow rendering or jest.mock() instead.\n\n' +
        'See https://reactjs.org/link/test-utils-mock-component for more information.',
      {withoutStack: true},
    );

    // De-duplication check
    ReactTestUtils.mockComponent(MockedComponent);

    const container = document.createElement('div');
    ReactDOM.render(<MockedComponent>Hello</MockedComponent>, container);
    expect(container.textContent).toBe('Hello');
  });

  it('can scryRenderedComponentsWithType', () => {
    class Child extends React.Component {
      render() {
        return null;
      }
    }
    class Wrapper extends React.Component {
      render() {
        return (
          <div>
            <Child />
          </div>
        );
      }
    }
    const renderedComponent = ReactTestUtils.renderIntoDocument(<Wrapper />);
    const scryResults = ReactTestUtils.scryRenderedComponentsWithType(
      renderedComponent,
      Child,
    );
    expect(scryResults.length).toBe(1);
  });

  it('can not handle stateless HOCs such as forwardRef', () => {
    // This is the underlying "Button" class - it gets wrapped before being exported to the end developer
    class Button extends React.Component {
      render() {
        return <button>Gedalia</button>;
      }
    }

    // Here the "Button" is wrapped in an HOC of some kind - we use ref for an easy example; I think its valid to use this as an example with 80% confidence
    // Remember if your internal component that you think you are interfacing with is wrapped then that is what is being exported to you as an end developer
    // So you would import the ForwardRefChild value, not the original component
    const ForwardRefChild = React.forwardRef(() => <Button />);

    // Wrapping it in one more useless layer of class components to make sure we can get a real component instance returned from renderIntoDocument; when renderedComponent is null, none of this matters
    class Wrapper extends React.Component {
      render() {
        return <ForwardRefChild />;
      }
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const renderedComponent = ReactDOM.render(<Wrapper />, container);
    expect(
      ReactTestUtils.isCompositeComponentWithType(renderedComponent, Wrapper),
    ).toBe(true);

    // Now when you look for the exported value type and you can't find it because: https://github.com/facebook/react/issues/13455#issuecomment-415088578
    // There is no "react fiber" that has been created to maintain the existence of the wrapping HOC; after all, its not really the thing getting rendered that requires a fiber to exist for
    const scryResults = ReactTestUtils.scryRenderedComponentsWithType(
      renderedComponent,
      ForwardRefChild,
    );
    expect(scryResults.length).toBe(0);

    // You can find the underlying stateful components though or DOM elements rendered by stateless components
    const scryStatefulResults = ReactTestUtils.scryRenderedComponentsWithType(
      renderedComponent,
      Button,
    );
    expect(scryStatefulResults.length).toBe(1);

    const domButton = ReactTestUtils.findRenderedDOMComponentWithTag(
      renderedComponent,
      'button',
    );
    expect(ReactTestUtils.isDOMComponent(domButton)).toBe(true);
    expect(domButton.textContent).toBe('Gedalia');

    // BUT you usually don't have access to the underlying tag or class
    // You can:
    //  1. Inspect the DOM and see if you can use the mind + trial and error to find the actual underlying element you need. I would not recommend since you are using implementation details (e.g. native DOM elements used) that can definitely be changed.
    //  2. Read the code of the dependency to accomplish the same if the underlying components are exposed or have dom elements to find
    //  3. Not test anything about the dependency in the first place (maybe mock), BUT that doesn't work if that component is needed ultimately for whatever crazy reason (e.g. Stripe components are needed to fill in the credit card form correctly)

    // For example, if I print out the DOM after rendering (using the document DOM API):

    // get a look at the whole thing with this:
    // expect(document.body.children).toEqual([<div><button /></div>]);

    expect(document.body.children[0].tagName.toLowerCase()).toBe('div');
    expect(document.body.children[0].children[0].tagName.toLowerCase()).toBe(
      'button',
    );

    // we can see the actual dom elements that have been rendered into the DOM and we can now search for those actual elements to navigate the component in tests (if we even should ever do that)

    // cleanup
    ReactDOM.unmountComponentAtNode(container);
    document.body.removeChild(container);
  });

  it('can not handle stateless HOCs such as Reverse', () => {
    // This is the underlying "Button" class - it gets wrapped before being exported to the end developer
    class Button extends React.Component {
      render() {
        return <button>{this.props.children}</button>;
      }
    }

    // Here the Button is wrapped in an HOC of some kind
    // Remember if your internal component that you think you are interfacing with is wrapped then that is what is being exported to you as an end developer
    // So you would import the ExportedComponent value, not the original component "Button"
    const Reverse = PassedComponent => ({children, ...props}) => (
      <PassedComponent {...props}>
        {children
          .split('')
          .reverse()
          .join('')}
      </PassedComponent>
    );

    const ReversedButton = Reverse(Button);
    const ExportedComponent = ReversedButton;

    // Wrapping it in one more useless layer of class components to make sure we can get a real component instance returned from renderIntoDocument; when renderedComponent is null, none of this matters
    class Wrapper extends React.Component {
      render() {
        return <ExportedComponent>Gedalia</ExportedComponent>;
      }
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const renderedComponent = ReactDOM.render(<Wrapper />, container);
    expect(
      ReactTestUtils.isCompositeComponentWithType(renderedComponent, Wrapper),
    ).toBe(true);

    // Now when you look for the exported value type and you can't find it because: https://github.com/facebook/react/issues/13455#issuecomment-415088578
    const scryResults = ReactTestUtils.scryRenderedComponentsWithType(
      renderedComponent,
      ExportedComponent,
    );
    expect(scryResults.length).toBe(0);

    // Even looking for the Reverse HOC type won't work
    const scryReverseHOCResults = ReactTestUtils.scryRenderedComponentsWithType(
      renderedComponent,
      Reverse,
    );
    expect(scryReverseHOCResults.length).toBe(0);

    // You can find the underlying stateful components though or DOM elements rendered by stateless components
    const scryStatefulResults = ReactTestUtils.scryRenderedComponentsWithType(
      renderedComponent,
      Button,
    );
    expect(scryStatefulResults.length).toBe(1);

    const domButton = ReactTestUtils.findRenderedDOMComponentWithTag(
      renderedComponent,
      'button',
    );
    expect(ReactTestUtils.isDOMComponent(domButton)).toBe(true);
    expect(domButton.textContent).toBe('ailadeG');

    // BUT you usually don't have access to the underlying tag or class
    // You can:
    //  1. Inspect the DOM and see if you can use the mind + trial and error to find the actual underlying element you need. I would not recommend since you are using implementation details that can definitely be changed.
    //  2. Read the code of the dependency to accomplish the same if the underlying components are exposed or have dom elements to find
    //  3. Not test anything about the dependency in the first place (maybe mock), BUT that doesn't work if that component is needed ultimately for whatever crazy reason (e.g. Stripe components are needed to fill in the credit card form correctly)

    // For example, if I print out the DOM after rendering (using the document DOM API):

    // get a look at the whole thing with this:
    // expect(document.body.children).toEqual([<div><button /></div>]);

    expect(document.body.children[0].tagName.toLowerCase()).toBe('div');
    expect(document.body.children[0].children[0].tagName.toLowerCase()).toBe(
      'button',
    );
    expect(document.body.children[0].children[0].textContent).toBe('ailadeG');

    // we can see the actual dom elements that have been rendered into the DOM and we can now search for those actual elements to navigate the component in tests (if we even should ever do that)

    // cleanup
    ReactDOM.unmountComponentAtNode(container);
    document.body.removeChild(container);
  });

  it('can handle stateful HOC types', () => {
    // This is the underlying "Button" class - it gets wrapped before being exported to the end developer
    class Button extends React.Component {
      render() {
        return <button>{this.props.children}</button>;
      }
    }

    // Here the Button is wrapped in an HOC of some kind
    // Remember if your internal component that you think you are interfacing with is wrapped then that is what is being exported to you as an end developer
    // So you would import the ForwardRefChild value, not the original component
    const isEmpty = prop =>
      prop === null ||
      prop === undefined ||
      (prop.hasOwnProperty('length') && prop.length === 0) ||
      (prop.constructor === Object && Object.keys(prop).length === 0);

    const Loading = loadingProp => WrappedComponent => {
      return class LoadingHOC extends React.Component {
        componentDidMount() {
          this.startTimer = Date.now();
        }

        componentDidUpdate(nextProps) {
          if (!isEmpty(nextProps[loadingProp])) {
            this.endTimer = Date.now();
          }
        }

        render() {
          const myProps = {
            loadingTime: ((this.endTimer - this.startTimer) / 1000).toFixed(2),
          };

          return isEmpty(this.props[loadingProp]) ? (
            <div className="loader" />
          ) : (
            <WrappedComponent {...this.props} {...myProps} />
          );
        }
      };
    };

    const ExportedComponent = Loading('name')(Button);
    const renderedComponent = ReactTestUtils.renderIntoDocument(
      <ExportedComponent>Gedalia</ExportedComponent>,
    );

    // Now when you look for the exported value type and you CAN find it because (the same line of reasoning): https://github.com/facebook/react/issues/13455#issuecomment-415088578
    const scryResults = ReactTestUtils.scryRenderedComponentsWithType(
      renderedComponent,
      ExportedComponent,
    );
    expect(scryResults.length).toBe(1);
  });

  it('can scryRenderedDOMComponentsWithClass with TextComponent', () => {
    class Wrapper extends React.Component {
      render() {
        return (
          <div>
            Hello <span>Jim</span>
          </div>
        );
      }
    }

    const renderedComponent = ReactTestUtils.renderIntoDocument(<Wrapper />);
    const scryResults = ReactTestUtils.scryRenderedDOMComponentsWithClass(
      renderedComponent,
      'NonExistentClass',
    );
    expect(scryResults.length).toBe(0);
  });

  it('can scryRenderedDOMComponentsWithClass with className contains \\n', () => {
    class Wrapper extends React.Component {
      render() {
        return (
          <div>
            Hello <span className={'x\ny'}>Jim</span>
          </div>
        );
      }
    }

    const renderedComponent = ReactTestUtils.renderIntoDocument(<Wrapper />);
    const scryResults = ReactTestUtils.scryRenderedDOMComponentsWithClass(
      renderedComponent,
      'x',
    );
    expect(scryResults.length).toBe(1);
  });

  it('can scryRenderedDOMComponentsWithClass with multiple classes', () => {
    class Wrapper extends React.Component {
      render() {
        return (
          <div>
            Hello <span className={'x y z'}>Jim</span>
          </div>
        );
      }
    }

    const renderedComponent = ReactTestUtils.renderIntoDocument(<Wrapper />);
    const scryResults1 = ReactTestUtils.scryRenderedDOMComponentsWithClass(
      renderedComponent,
      'x y',
    );
    expect(scryResults1.length).toBe(1);

    const scryResults2 = ReactTestUtils.scryRenderedDOMComponentsWithClass(
      renderedComponent,
      'x z',
    );
    expect(scryResults2.length).toBe(1);

    const scryResults3 = ReactTestUtils.scryRenderedDOMComponentsWithClass(
      renderedComponent,
      ['x', 'y'],
    );
    expect(scryResults3.length).toBe(1);

    expect(scryResults1[0]).toBe(scryResults2[0]);
    expect(scryResults1[0]).toBe(scryResults3[0]);

    const scryResults4 = ReactTestUtils.scryRenderedDOMComponentsWithClass(
      renderedComponent,
      ['x', 'a'],
    );
    expect(scryResults4.length).toBe(0);

    const scryResults5 = ReactTestUtils.scryRenderedDOMComponentsWithClass(
      renderedComponent,
      ['x a'],
    );
    expect(scryResults5.length).toBe(0);
  });

  it('traverses children in the correct order', () => {
    class Wrapper extends React.Component {
      render() {
        return <div>{this.props.children}</div>;
      }
    }

    const container = document.createElement('div');
    ReactDOM.render(
      <Wrapper>
        {null}
        <div>purple</div>
      </Wrapper>,
      container,
    );
    const tree = ReactDOM.render(
      <Wrapper>
        <div>orange</div>
        <div>purple</div>
      </Wrapper>,
      container,
    );

    const log = [];
    ReactTestUtils.findAllInRenderedTree(tree, function(child) {
      if (ReactTestUtils.isDOMComponent(child)) {
        log.push(ReactDOM.findDOMNode(child).textContent);
      }
    });

    // Should be document order, not mount order (which would be purple, orange)
    expect(log).toEqual(['orangepurple', 'orange', 'purple']);
  });

  it('should support injected wrapper components as DOM components', () => {
    const injectedDOMComponents = [
      'button',
      'form',
      'iframe',
      'img',
      'input',
      'option',
      'select',
      'textarea',
    ];

    injectedDOMComponents.forEach(function(type) {
      const testComponent = ReactTestUtils.renderIntoDocument(
        React.createElement(type),
      );
      expect(testComponent.tagName).toBe(type.toUpperCase());
      expect(ReactTestUtils.isDOMComponent(testComponent)).toBe(true);
    });

    // Full-page components (html, head, body) can't be rendered into a div
    // directly...
    class Root extends React.Component {
      render() {
        return (
          <html ref="html">
            <head ref="head">
              <title>hello</title>
            </head>
            <body ref="body">hello, world</body>
          </html>
        );
      }
    }

    const markup = ReactDOMServer.renderToString(<Root />);
    const testDocument = getTestDocument(markup);
    const component = ReactDOM.hydrate(<Root />, testDocument);

    expect(component.refs.html.tagName).toBe('HTML');
    expect(component.refs.head.tagName).toBe('HEAD');
    expect(component.refs.body.tagName).toBe('BODY');
    expect(ReactTestUtils.isDOMComponent(component.refs.html)).toBe(true);
    expect(ReactTestUtils.isDOMComponent(component.refs.head)).toBe(true);
    expect(ReactTestUtils.isDOMComponent(component.refs.body)).toBe(true);
  });

  it('can scry with stateless components involved', () => {
    const Function = () => (
      <div>
        <hr />
      </div>
    );

    class SomeComponent extends React.Component {
      render() {
        return (
          <div>
            <Function />
            <hr />
          </div>
        );
      }
    }

    const inst = ReactTestUtils.renderIntoDocument(<SomeComponent />);
    const hrs = ReactTestUtils.scryRenderedDOMComponentsWithTag(inst, 'hr');
    expect(hrs.length).toBe(2);
  });

  it('provides a clear error when passing invalid objects to scry', () => {
    // This is probably too relaxed but it's existing behavior.
    ReactTestUtils.findAllInRenderedTree(null, 'span');
    ReactTestUtils.findAllInRenderedTree(undefined, 'span');
    ReactTestUtils.findAllInRenderedTree('', 'span');
    ReactTestUtils.findAllInRenderedTree(0, 'span');
    ReactTestUtils.findAllInRenderedTree(false, 'span');

    expect(() => {
      ReactTestUtils.findAllInRenderedTree([], 'span');
    }).toThrow(
      'findAllInRenderedTree(...): the first argument must be a React class instance. ' +
        'Instead received: an array.',
    );
    expect(() => {
      ReactTestUtils.scryRenderedDOMComponentsWithClass(10, 'button');
    }).toThrow(
      'scryRenderedDOMComponentsWithClass(...): the first argument must be a React class instance. ' +
        'Instead received: 10.',
    );
    expect(() => {
      ReactTestUtils.findRenderedDOMComponentWithClass('hello', 'button');
    }).toThrow(
      'findRenderedDOMComponentWithClass(...): the first argument must be a React class instance. ' +
        'Instead received: hello.',
    );
    expect(() => {
      ReactTestUtils.scryRenderedDOMComponentsWithTag(
        {x: true, y: false},
        'span',
      );
    }).toThrow(
      'scryRenderedDOMComponentsWithTag(...): the first argument must be a React class instance. ' +
        'Instead received: object with keys {x, y}.',
    );
    const div = document.createElement('div');
    expect(() => {
      ReactTestUtils.findRenderedDOMComponentWithTag(div, 'span');
    }).toThrow(
      'findRenderedDOMComponentWithTag(...): the first argument must be a React class instance. ' +
        'Instead received: a DOM node.',
    );
    expect(() => {
      ReactTestUtils.scryRenderedComponentsWithType(true, 'span');
    }).toThrow(
      'scryRenderedComponentsWithType(...): the first argument must be a React class instance. ' +
        'Instead received: true.',
    );
    expect(() => {
      ReactTestUtils.findRenderedComponentWithType(true, 'span');
    }).toThrow(
      'findRenderedComponentWithType(...): the first argument must be a React class instance. ' +
        'Instead received: true.',
    );
  });

  describe('Simulate', () => {
    it('should change the value of an input field', () => {
      const obj = {
        handler: function(e) {
          e.persist();
        },
      };
      spyOnDevAndProd(obj, 'handler').and.callThrough();
      const container = document.createElement('div');
      const node = ReactDOM.render(
        <input type="text" onChange={obj.handler} />,
        container,
      );

      node.value = 'giraffe';
      ReactTestUtils.Simulate.change(node);

      expect(obj.handler).toHaveBeenCalledWith(
        expect.objectContaining({target: node}),
      );
    });

    it('should change the value of an input field in a component', () => {
      class SomeComponent extends React.Component {
        render() {
          return (
            <div>
              <input
                type="text"
                ref="input"
                onChange={this.props.handleChange}
              />
            </div>
          );
        }
      }

      const obj = {
        handler: function(e) {
          e.persist();
        },
      };
      spyOnDevAndProd(obj, 'handler').and.callThrough();
      const container = document.createElement('div');
      const instance = ReactDOM.render(
        <SomeComponent handleChange={obj.handler} />,
        container,
      );

      const node = instance.refs.input;
      node.value = 'zebra';
      ReactTestUtils.Simulate.change(node);

      expect(obj.handler).toHaveBeenCalledWith(
        expect.objectContaining({target: node}),
      );
    });

    it('should throw when attempting to use a React element', () => {
      class SomeComponent extends React.Component {
        render() {
          return <div onClick={this.props.handleClick}>hello, world.</div>;
        }
      }

      const handler = jest.fn().mockName('spy');
      const shallowRenderer = ReactShallowRenderer.createRenderer();
      const result = shallowRenderer.render(
        <SomeComponent handleClick={handler} />,
      );

      expect(() => ReactTestUtils.Simulate.click(result)).toThrowError(
        'TestUtils.Simulate expected a DOM node as the first argument but received ' +
          'a React element. Pass the DOM node you wish to simulate the event on instead. ' +
          'Note that TestUtils.Simulate will not work if you are using shallow rendering.',
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it('should throw when attempting to use a component instance', () => {
      class SomeComponent extends React.Component {
        render() {
          return <div onClick={this.props.handleClick}>hello, world.</div>;
        }
      }

      const handler = jest.fn().mockName('spy');
      const container = document.createElement('div');
      const instance = ReactDOM.render(
        <SomeComponent handleClick={handler} />,
        container,
      );

      expect(() => ReactTestUtils.Simulate.click(instance)).toThrowError(
        'TestUtils.Simulate expected a DOM node as the first argument but received ' +
          'a component instance. Pass the DOM node you wish to simulate the event on instead.',
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not warn when used with extra properties', () => {
      const CLIENT_X = 100;

      class Component extends React.Component {
        handleClick = e => {
          expect(e.clientX).toBe(CLIENT_X);
        };

        render() {
          return <div onClick={this.handleClick} />;
        }
      }

      const element = document.createElement('div');
      const instance = ReactDOM.render(<Component />, element);
      ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(instance), {
        clientX: CLIENT_X,
      });
    });

    it('should set the type of the event', () => {
      let event;
      const stub = jest.fn().mockImplementation(e => {
        e.persist();
        event = e;
      });

      const container = document.createElement('div');
      const instance = ReactDOM.render(<div onKeyDown={stub} />, container);
      const node = ReactDOM.findDOMNode(instance);

      ReactTestUtils.Simulate.keyDown(node);

      expect(event.type).toBe('keydown');
      expect(event.nativeEvent.type).toBe('keydown');
    });

    it('should work with renderIntoDocument', () => {
      const onChange = jest.fn();

      class MyComponent extends React.Component {
        render() {
          return (
            <div>
              <input type="text" onChange={onChange} />
            </div>
          );
        }
      }

      const instance = ReactTestUtils.renderIntoDocument(<MyComponent />);
      const input = ReactTestUtils.findRenderedDOMComponentWithTag(
        instance,
        'input',
      );
      input.value = 'giraffe';
      ReactTestUtils.Simulate.change(input);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({target: input}),
      );
    });
  });

  it('should call setState callback with no arguments', () => {
    let mockArgs;
    class Component extends React.Component {
      componentDidMount() {
        this.setState({}, (...args) => (mockArgs = args));
      }
      render() {
        return false;
      }
    }

    ReactTestUtils.renderIntoDocument(<Component />);
    expect(mockArgs.length).toEqual(0);
  });
});
